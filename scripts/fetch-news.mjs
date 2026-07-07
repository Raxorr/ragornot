#!/usr/bin/env node
/**
 * fetch-news.mjs
 *
 * Pulls AI / LLM / RAG / cost / environment news from a handful of curated,
 * keyless sources, filters + tags + dedupes them, and writes public/news.json.
 *
 * Local:
 *   npm run fetch-news
 *
 * AWS Lambda:
 *   The `handler` export below is a drop-in Lambda handler. Deploy this file
 *   (Node.js 20+ runtime) and point an EventBridge Scheduler rule at it:
 *
 *     aws scheduler create-schedule \
 *       --name ragornot-fetch-news \
 *       --schedule-expression "rate(6 hours)" \
 *       --flexible-time-window '{"Mode":"OFF"}' \
 *       --target '{"Arn":"<lambda-arn>","RoleArn":"<invoke-role-arn>"}'
 *
 *   Set NEWS_BUCKET (and optionally NEWS_KEY, default "news.json") as Lambda
 *   env vars so the handler writes straight to the S3 bucket your
 *   CloudFront distribution serves from, instead of the local filesystem —
 *   that's how the static-export deploy path (see README "Deploy — S3 +
 *   CloudFront") keeps news.json fresh without a rebuild. The Lambda's
 *   execution role needs s3:PutObject on that bucket/key. If the
 *   distribution caches news.json, add a CloudFront invalidation step
 *   (`aws cloudfront create-invalidation --paths /news.json`) after the
 *   PutObject call, or set a short Cache-Control/TTL on that object instead.
 *
 * No API key is required for any of the sources below. If you add a source
 * that needs one, read it from an env var and skip that source (not the
 * whole run) when it's missing — see `NEWSAPI_KEY` for the pattern.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEYWORDS = [
  "rag",
  "retrieval",
  "retrieval-augmented",
  "llm",
  "large language model",
  "embedding",
  "inference cost",
  "energy",
  "carbon",
  "sustainability",
];

// RSS/Atom feeds — every one of these is public and keyless.
// Dead feeds removed after live probe (2026-07-07):
//   Anthropic: no public RSS endpoint (all paths 404)
//   LangChain: blog.langchain.dev/rss redirects to non-RSS HTML page
//   LlamaIndex: all candidate URLs 404
//   Pinecone: all candidate URLs 404
//   Cohere: rss endpoint redirects to non-RSS HTML page
// Qdrant URL corrected from /articles/rss.xml → /blog/index.xml
const RSS_SOURCES = [
  // arXiv — high volume; per-source cap in buildNewsPayload keeps it from flooding the feed
  { name: "arXiv (cs.CL)", url: "http://export.arxiv.org/rss/cs.CL", defaultTopic: "RAG" },
  { name: "arXiv (cs.IR)", url: "http://export.arxiv.org/rss/cs.IR", defaultTopic: "RAG" },
  // Vendor / official blogs
  { name: "OpenAI", url: "https://openai.com/news/rss.xml", defaultTopic: "LLM" },
  {
    name: "AWS Machine Learning Blog",
    url: "https://aws.amazon.com/blogs/machine-learning/feed/",
    defaultTopic: "Cost",
  },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml", defaultTopic: "RAG" },
  { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", defaultTopic: "AI" },
  { name: "DeepMind Blog", url: "https://deepmind.google/blog/rss.xml", defaultTopic: "AI" },
  // RAG / vector-search tooling blogs (working feeds only)
  { name: "Weaviate Blog", url: "https://weaviate.io/blog/rss.xml", defaultTopic: "RAG" },
  { name: "Qdrant Blog", url: "https://qdrant.tech/blog/index.xml", defaultTopic: "RAG" },
  // Independent & media — AI research/news coverage
  // skipKeywordFilter: true for feeds that are already curated to AI content;
  // keyword matching is redundant and would incorrectly drop relevant articles.
  { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", defaultTopic: "AI", skipKeywordFilter: true },
  { name: "The Gradient", url: "https://thegradient.pub/rss/", defaultTopic: "AI", skipKeywordFilter: true },
  { name: "Simon Willison's Blog", url: "https://simonwillison.net/atom/everything/", defaultTopic: "LLM" },
  // AI newsletters (Substack) — replace dead vendor blogs with high-signal independent coverage
  { name: "Last Week in AI", url: "https://lastweekinai.substack.com/feed", defaultTopic: "AI", skipKeywordFilter: true },
  { name: "Import AI", url: "https://importai.substack.com/feed", defaultTopic: "AI", skipKeywordFilter: true },
  { name: "Ahead of AI", url: "https://magazine.sebastianraschka.com/feed", defaultTopic: "LLM", skipKeywordFilter: true },
];

// Hacker News via the Algolia Search API — also keyless.
const HN_QUERIES = [
  "RAG retrieval augmented generation",
  "LLM inference cost",
  "AI energy carbon footprint",
  "vector database embeddings",
];

// Global ceiling — well above PER_SOURCE_MAX × source-count so the per-source
// cap is always the binding limit, not this one.
const MAX_ITEMS = 200;
// Keep at most this many items per source before global truncation.
// Prevents any single high-volume feed (arXiv, OpenAI) from pushing out others.
const PER_SOURCE_MAX = 8;
const OUTPUT_PATH = path.join(process.cwd(), "public", "news.json");
const USER_AGENT = "ragornot-news-fetcher/1.0 (+https://github.com/Raxorr/ragornot)";
const FETCH_TIMEOUT_MS = 10_000;

/** Fetch text with a timeout; returns null (never throws) on any failure. */
async function fetchTextSafe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[fetch-news] ${url} -> HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[fetch-news] ${url} -> ${err instanceof Error ? err.message : err}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(str) {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

function stripHtml(str) {
  // Decode entities FIRST so entity-encoded HTML (e.g. &lt;img&gt;) gets stripped,
  // not passed through as literal text (which was the previous bug).
  const cdataUnwrapped = str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const decoded = decodeEntities(cdataUnwrapped);
  return decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

/** Atom <link href="..."/> and RSS <link>text</link> both show up in the wild. */
function extractLink(block) {
  const hrefMatch = block.match(/<link[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  if (hrefMatch) return hrefMatch[1];
  const textMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  return textMatch ? textMatch[1].trim() : "";
}

/**
 * Extract an image URL from an RSS/Atom entry block.
 * Tries <media:content>, <media:thumbnail>, <enclosure type="image/...">,
 * and <itunes:image> in that order. Returns null if nothing is found.
 * Upgrades http:// to https:// so images load on GitHub Pages (HTTPS).
 */
function extractImage(block) {
  let url = null;

  // <media:content url="..." medium="image" .../>  (WordPress, HF, AWS ML Blog)
  const mediaContent = block.match(/<media:content[^>]+>/i);
  if (mediaContent) {
    const isMediumImage = /\bmedium=["']image["']/i.test(mediaContent[0]);
    const urlMatch = mediaContent[0].match(/\burl=["']([^"']+)["']/i);
    if (urlMatch && (isMediumImage || /\.(jpe?g|png|webp|gif)/i.test(urlMatch[1]))) {
      url = urlMatch[1];
    }
  }

  // <media:thumbnail url="..."/>
  if (!url) {
    const mediaThumbnail = block.match(/<media:thumbnail[^>]+>/i);
    if (mediaThumbnail) {
      const urlMatch = mediaThumbnail[0].match(/\burl=["']([^"']+)["']/i);
      if (urlMatch) url = urlMatch[1];
    }
  }

  // <enclosure url="..." type="image/..."/>
  if (!url) {
    const enclosure = block.match(/<enclosure[^>]+type=["']image\/[^"']*["'][^>]*>/i);
    if (enclosure) {
      const urlMatch = enclosure[0].match(/\burl=["']([^"']+)["']/i);
      if (urlMatch) url = urlMatch[1];
    }
  }

  // <itunes:image href="..."/>
  if (!url) {
    const itunesImage = block.match(/<itunes:image[^>]+>/i);
    if (itunesImage) {
      const hrefMatch = itunesImage[0].match(/\bhref=["']([^"']+)["']/i);
      if (hrefMatch) url = hrefMatch[1];
    }
  }

  if (!url) return null;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  return url.startsWith("https://") ? url : null;
}

/**
 * Tolerant, regex-based RSS 2.0 / Atom parser — good enough for the small,
 * well-behaved feeds this script targets. Swap in a real XML parser (e.g.
 * fast-xml-parser) if you widen the source list to less predictable feeds.
 */
function parseFeed(xml, sourceName, defaultTopic) {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const entryTag = isAtom ? "entry" : "item";
  const blocks = xml.match(new RegExp(`<${entryTag}[\\s\\S]*?</${entryTag}>`, "gi")) ?? [];

  return blocks.map((block) => {
    const title = extractTag(block, "title");
    const url = extractLink(block);
    const dateRaw = extractTag(block, isAtom ? "updated" : "pubDate") || extractTag(block, "published");
    const summary = extractTag(block, isAtom ? "summary" : "description");
    const publishedAt = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();
    const imageUrl = extractImage(block) ?? undefined;

    return {
      headline: title,
      url,
      source: sourceName,
      publishedAt,
      summary: summary ? summary.slice(0, 220) : undefined,
      imageUrl,
      defaultTopic,
    };
  });
}

async function fetchRssSource(source) {
  const xml = await fetchTextSafe(source.url);
  if (!xml) {
    console.warn(`[fetch-news] ${source.name}: fetch failed or returned empty`);
    return [];
  }
  try {
    const items = parseFeed(xml, source.name, source.defaultTopic);
    console.log(`[fetch-news] ${source.name}: ${items.length} raw items`);
    return items.map((item) => ({ ...item, skipKeywordFilter: source.skipKeywordFilter ?? false }));
  } catch (err) {
    console.warn(`[fetch-news] ${source.name}: parse error — ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

async function fetchHackerNews(query) {
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=15`;
  const raw = await fetchTextSafe(url);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    const items = (data.hits ?? [])
      .filter((hit) => hit.title && (hit.url || hit.objectID))
      .map((hit) => ({
        headline: hit.title,
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        source: "Hacker News",
        publishedAt: hit.created_at ? new Date(hit.created_at).toISOString() : new Date().toISOString(),
        summary: undefined,
        defaultTopic: undefined,
      }));
    console.log(`[fetch-news] Hacker News ("${query}"): ${items.length} raw items`);
    return items;
  } catch (err) {
    console.warn(`[fetch-news] Hacker News: parse error — ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

/** Optional, key-gated source — shows the "degrade gracefully" pattern. */
async function fetchNewsApiSource() {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    console.log("[fetch-news] NEWSAPI_KEY not set — skipping the NewsAPI.org source.");
    return [];
  }
  const url = `https://newsapi.org/v2/everything?q=RAG%20OR%20%22retrieval%20augmented%20generation%22&sortBy=publishedAt&pageSize=15&apiKey=${apiKey}`;
  const raw = await fetchTextSafe(url);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return (data.articles ?? []).map((a) => ({
      headline: a.title,
      url: a.url,
      source: a.source?.name || "NewsAPI",
      publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString() : new Date().toISOString(),
      summary: a.description ?? undefined,
      defaultTopic: undefined,
    }));
  } catch (err) {
    console.warn(`[fetch-news] failed to parse NewsAPI response: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

function matchesKeywords(item) {
  const haystack = `${item.headline} ${item.summary ?? ""}`.toLowerCase();
  return KEYWORDS.some((kw) => haystack.includes(kw));
}

const TOPIC_RULES = [
  { topic: "RAG", keywords: ["rag", "retrieval-augmented", "retrieval augmented", "retrieval"] },
  { topic: "Cost", keywords: ["cost", "pricing", "price", "spend", "cheaper", "expensive"] },
  { topic: "Environment", keywords: ["carbon", "energy", "co2", "co₂", "sustainab", "emission", "climate"] },
  { topic: "LLM", keywords: ["llm", "large language model", "gpt", "claude", "gemini", "language model"] },
];

function classifyTopic(item) {
  const haystack = `${item.headline} ${item.summary ?? ""}`.toLowerCase();
  for (const rule of TOPIC_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) return rule.topic;
  }
  return item.defaultTopic ?? "AI";
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    return u.toString();
  } catch {
    return url;
  }
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Fetch every source, filter/tag/dedupe, and return the trimmed item list — the part shared by the CLI entrypoint and the Lambda handler. */
export async function buildNewsPayload() {
  const [rssResults, hnResults, newsApiResults] = await Promise.all([
    Promise.all(RSS_SOURCES.map(fetchRssSource)),
    Promise.all(HN_QUERIES.map(fetchHackerNews)),
    fetchNewsApiSource(),
  ]);

  const raw = [...rssResults.flat(), ...hnResults.flat(), ...newsApiResults].filter(
    (item) => item.headline && item.url,
  );

  // Items from curated-AI sources skip the keyword check (flag set in RSS_SOURCES).
  // All other items must match at least one keyword to be included.
  const keywordFiltered = raw.filter((item) => item.skipKeywordFilter || matchesKeywords(item));

  const seen = new Set();
  const deduped = [];
  for (const item of keywordFiltered) {
    const key = normalizeUrl(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const tagged = deduped.map((item) => ({
    id: `${slugify(item.source)}-${slugify(item.headline)}`,
    headline: item.headline,
    source: item.source,
    url: item.url,
    publishedAt: item.publishedAt,
    topic: classifyTopic(item),
    summary: item.summary,
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
  }));

  // Sort newest-first so the per-source cap keeps the most recent items.
  tagged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Per-source cap: walk the sorted list and admit at most PER_SOURCE_MAX items
  // per source. This ensures every working feed is represented regardless of
  // how many raw items high-volume sources (arXiv, OpenAI) contribute.
  const sourceCounts = new Map();
  const capped = [];
  for (const item of tagged) {
    const n = sourceCounts.get(item.source) ?? 0;
    if (n < PER_SOURCE_MAX) {
      capped.push(item);
      sourceCounts.set(item.source, n + 1);
    }
  }

  // Log per-source counts so CI / manual runs make feed health visible.
  const finalCounts = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`[fetch-news] ${capped.length} items across ${finalCounts.length} sources (cap: ${PER_SOURCE_MAX}/source):`);
  for (const [src, n] of finalCounts) {
    console.log(`  ${String(n).padStart(2)}  ${src}`);
  }

  return capped.slice(0, MAX_ITEMS);
}

async function writeLocalNewsJson(items) {
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(items, null, 2)}\n`, "utf-8");
  console.log(`[fetch-news] wrote ${items.length} items to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

/** CLI entrypoint: `npm run fetch-news`. */
export async function run() {
  const items = await buildNewsPayload();
  if (items.length === 0) {
    console.warn("[fetch-news] fetched 0 items (likely a network issue) — leaving the existing news.json in place.");
    return;
  }
  await writeLocalNewsJson(items);
}

/**
 * AWS Lambda handler. Writes to S3 when NEWS_BUCKET is set (the
 * S3 + CloudFront deploy path), otherwise falls back to the local
 * filesystem so this same file works unmodified in both places.
 */
export async function handler() {
  const items = await buildNewsPayload();
  if (items.length === 0) {
    console.warn("[fetch-news] fetched 0 items — leaving the existing news.json in place.");
    return { statusCode: 200, body: JSON.stringify({ count: 0, skipped: true }) };
  }

  const bucket = process.env.NEWS_BUCKET;
  if (bucket) {
    // @aws-sdk/client-s3 ships with the AWS Lambda Node.js runtime, so it
    // doesn't need to be a project dependency for this branch to run there.
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({});
    const key = process.env.NEWS_KEY || "news.json";
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(items, null, 2),
        ContentType: "application/json",
        CacheControl: "max-age=300",
      }),
    );
    console.log(`[fetch-news] wrote ${items.length} items to s3://${bucket}/${key}`);
  } else {
    await writeLocalNewsJson(items);
  }

  return { statusCode: 200, body: JSON.stringify({ count: items.length }) };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  run();
}
