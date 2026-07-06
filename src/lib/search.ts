// A small, real, in-browser lexical search engine over a curated AWS-docs
// corpus (see src/data/aws-docs-corpus.json). Flat and Hierarchical modes do
// genuine TF-IDF scoring and report real measured latency. LLM-only and RAG
// modes never call a live model (no API key is shipped or required — see the
// README) — their "generation" step and its latency/cost are simulated, and
// every result from those two modes is labeled as such in the UI.
import corpusData from "@/data/aws-docs-corpus.json";
import type { RetrievalMode } from "./config";

export interface CorpusChunk {
  id: string;
  service: string;
  title: string;
  heading: string;
  url: string;
  text: string;
}

export interface RetrievalMatch {
  chunk: CorpusChunk;
  score: number;
  snippet: string;
}

export interface RetrievalResult {
  mode: RetrievalMode;
  query: string;
  latencyMs: number;
  costUsd: number;
  matches: RetrievalMatch[];
  answer?: string;
  simulated: boolean;
  docsFocused?: number;
  docsConsidered?: number;
}

const corpus = corpusData as CorpusChunk[];

export const corpusSize = corpus.length;
export const corpusServices = Array.from(new Set(corpus.map((c) => c.service)));

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "for", "on", "with", "is",
  "are", "this", "that", "it", "as", "by", "be", "your", "you", "can", "how",
  "what", "do", "does", "i", "we", "my", "me", "from", "at", "into", "using",
  "use", "when", "which", "who", "will",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// ---- Inverted index + IDF table, built once at module load. ----
const docFreq = new Map<string, number>();
const chunkTokens = new Map<string, string[]>();

for (const chunk of corpus) {
  const tokens = tokenize(`${chunk.heading} ${chunk.text}`);
  chunkTokens.set(chunk.id, tokens);
  for (const term of new Set(tokens)) {
    docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  }
}

function idf(term: string): number {
  const df = docFreq.get(term) ?? 0;
  return Math.log((corpus.length + 1) / (df + 1)) + 1;
}

function scoreChunk(queryTerms: string[], chunk: CorpusChunk): number {
  const tokens = chunkTokens.get(chunk.id) ?? [];
  if (tokens.length === 0 || queryTerms.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);

  let score = 0;
  for (const term of queryTerms) {
    const tf = freq.get(term) ?? 0;
    if (tf === 0) continue;
    score += (tf / Math.sqrt(tokens.length)) * idf(term);
  }

  // Heading match is a strong signal in short docs — nudge it up.
  const headingTokens = new Set(tokenize(chunk.heading));
  for (const term of queryTerms) {
    if (headingTokens.has(term)) score += idf(term) * 0.5;
  }

  return score;
}

function snippetOf(chunk: CorpusChunk, maxLen = 220): string {
  return chunk.text.length > maxLen ? `${chunk.text.slice(0, maxLen).trim()}…` : chunk.text;
}

function toMatches(scored: Array<{ chunk: CorpusChunk; score: number }>): RetrievalMatch[] {
  return scored.map((r) => ({ chunk: r.chunk, score: r.score, snippet: snippetOf(r.chunk) }));
}

function searchFlat(query: string, limit: number) {
  const terms = tokenize(query);
  return corpus
    .map((chunk) => ({ chunk, score: scoreChunk(terms, chunk) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Document → section → chunk narrowing: score everything once, pick the
// strongest documents, then only rank chunks that belong to those documents.
function searchHierarchical(query: string, limit: number) {
  const terms = tokenize(query);
  const scoredChunks = corpus.map((chunk) => ({ chunk, score: scoreChunk(terms, chunk) }));

  const byDoc = new Map<string, Array<{ chunk: CorpusChunk; score: number }>>();
  for (const item of scoredChunks) {
    const list = byDoc.get(item.chunk.url) ?? [];
    list.push(item);
    byDoc.set(item.chunk.url, list);
  }

  const docs = Array.from(byDoc.values())
    .map((items) => ({ items, best: Math.max(...items.map((i) => i.score)) }))
    .filter((d) => d.best > 0)
    .sort((a, b) => b.best - a.best);

  const topDocs = docs.slice(0, 2);
  const matches = topDocs.flatMap((doc) =>
    doc.items
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
  );
  matches.sort((a, b) => b.score - a.score);

  return { matches: matches.slice(0, limit), docsFocused: topDocs.length, docsConsidered: docs.length };
}

// ---- Service detection + canned copy for the two "generative" modes. ----
const SERVICE_KEYWORDS: Record<string, string[]> = {
  IAM: ["iam", "permission", "policy", "role", "access control"],
  Lambda: ["lambda", "function url", "serverless function"],
  S3: ["s3", "bucket", "static hosting", "static website"],
  "API Gateway": ["api gateway", "apigateway", "rest api", "http api"],
  CloudFront: ["cloudfront", "cdn", "distribution", "edge cache"],
};

function detectService(query: string): string | null {
  const q = query.toLowerCase();
  let best: { service: string; index: number } | null = null;
  for (const [service, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    for (const kw of keywords) {
      const idx = q.indexOf(kw);
      if (idx !== -1 && (best === null || idx < best.index)) {
        best = { service, index: idx };
      }
    }
  }
  return best?.service ?? null;
}

const LLM_ONLY_ANSWERS: Record<string, string> = {
  Lambda:
    "AWS Lambda is a serverless compute service that runs your code in response to events. You'd typically attach an execution role and a trigger and let Lambda manage the infrastructure — though exact console steps or newer feature names aren't something this mode can confirm.",
  S3: "Amazon S3 is an object storage service. Hosting something publicly usually means creating a bucket, uploading objects, and adjusting its access settings — but current recommended settings and console labels aren't something this mode can verify.",
  IAM: "AWS IAM controls who can do what in an account, generally through policies attached to users, groups, or roles. The specifics of any one permission model would need to be checked against current documentation.",
  "API Gateway":
    "Amazon API Gateway exposes HTTP or REST endpoints that can trigger backend compute like Lambda. Integration steps and payload formats vary by API type, so treat this as a general description, not a procedure.",
  CloudFront:
    "Amazon CloudFront is AWS's content delivery network, caching content at edge locations near users. Origin types and cache-behavior details are best verified against current docs.",
};

const LLM_ONLY_FALLBACK =
  "This is a general-knowledge answer with no document retrieval behind it — it may be generic, outdated, or wrong on AWS specifics. That gap is exactly what this mode exists to illustrate.";

function buildRagAnswer(matches: RetrievalMatch[]): string {
  if (matches.length === 0) {
    return "No indexed snippet matched closely enough to ground an answer — try a different phrasing, or check the Flat/Hierarchical results for this query.";
  }
  return matches
    .slice(0, 2)
    .map((m, i) => `${m.snippet} [${i + 1}]`)
    .join(" ");
}

// ---- Deterministic pseudo-randomness so repeated searches for the same
// query are stable, instead of jittering on every keystroke. ----
function seedFromString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Illustrative blended per-token rate for a small hosted model — a stand-in
// for "some LLM API call," not any one vendor's live pricing.
const INPUT_RATE_PER_MTOK = 0.15;
const OUTPUT_RATE_PER_MTOK = 0.6;

function simulateGenerationStats(query: string, mode: "llm-only" | "rag", contextTokens: number) {
  const rng = mulberry32(seedFromString(`${mode}:${query}`));
  const promptTokens =
    mode === "rag" ? 60 + contextTokens + Math.floor(rng() * 40) : 20 + Math.floor(rng() * 20);
  const completionTokens = 120 + Math.floor(rng() * 120);
  const latencyMs = Math.round((mode === "rag" ? 640 : 520) + rng() * 380);
  const costUsd =
    (promptTokens / 1_000_000) * INPUT_RATE_PER_MTOK + (completionTokens / 1_000_000) * OUTPUT_RATE_PER_MTOK;
  return { promptTokens, completionTokens, latencyMs, costUsd };
}

export function runRetrieval(query: string, mode: RetrievalMode): RetrievalResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { mode, query: trimmed, latencyMs: 0, costUsd: 0, matches: [], simulated: false };
  }

  if (mode === "flat") {
    const start = performance.now();
    const matches = toMatches(searchFlat(trimmed, 5));
    const latencyMs = performance.now() - start;
    return { mode, query: trimmed, latencyMs, costUsd: 0, matches, simulated: false };
  }

  if (mode === "hierarchical") {
    const start = performance.now();
    const { matches: raw, docsFocused, docsConsidered } = searchHierarchical(trimmed, 5);
    const latencyMs = performance.now() - start;
    return {
      mode,
      query: trimmed,
      latencyMs,
      costUsd: 0,
      matches: toMatches(raw),
      simulated: false,
      docsFocused,
      docsConsidered,
    };
  }

  if (mode === "llm-only") {
    const service = detectService(trimmed);
    const answer = (service && LLM_ONLY_ANSWERS[service]) || LLM_ONLY_FALLBACK;
    const stats = simulateGenerationStats(trimmed, "llm-only", 0);
    return {
      mode,
      query: trimmed,
      latencyMs: stats.latencyMs,
      costUsd: stats.costUsd,
      matches: [],
      answer,
      simulated: true,
    };
  }

  // RAG: real retrieval for grounding, simulated generation on top of it.
  const { matches: raw } = searchHierarchical(trimmed, 4);
  const matches = toMatches(raw);
  const contextTokens = matches.reduce((sum, m) => sum + Math.round(m.chunk.text.split(/\s+/).length * 1.3), 0);
  const stats = simulateGenerationStats(trimmed, "rag", contextTokens);
  return {
    mode,
    query: trimmed,
    latencyMs: stats.latencyMs,
    costUsd: stats.costUsd,
    matches,
    answer: buildRagAnswer(matches),
    simulated: true,
  };
}
