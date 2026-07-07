import type { NewsItem } from "./news-types";

// ─── Source → category taxonomy ─────────────────────────────────────────────
// Edit this object to reassign a source to a different category.
// Keys are exact source names as they appear in news.json.
// Values are category IDs from CATEGORIES below.
// Any source not in this map falls into the "More" category.
export const SOURCE_CATEGORIES: Record<string, string> = {
  // Research & Community
  "arXiv (cs.CL)": "research",
  "arXiv (cs.IR)": "research",
  "Hacker News":   "research",

  // Vendor & Official
  "OpenAI":                    "vendor",
  "Anthropic":                 "vendor",
  "AWS Machine Learning Blog": "vendor",
  "Hugging Face Blog":         "vendor",
  "Google AI Blog":            "vendor",
  "DeepMind Blog":             "vendor",
  "Cohere Blog":               "vendor",
  "LangChain Blog":            "vendor",
  "LlamaIndex Blog":           "vendor",
  "Pinecone Blog":             "vendor",
  "Weaviate Blog":             "vendor",
  "Qdrant Blog":               "vendor",

  // Independent & Media
  "VentureBeat AI":        "media",
  "The Gradient":          "media",
  "Simon Willison's Blog": "media",
};

// Fallback source URLs for items from older news.json without source_url field.
// Kept in sync with RSS_SOURCES in scripts/fetch-news.mjs.
export const SOURCE_URLS: Record<string, string> = {
  "arXiv (cs.CL)":           "https://arxiv.org/list/cs.CL/recent",
  "arXiv (cs.IR)":           "https://arxiv.org/list/cs.IR/recent",
  "Hacker News":             "https://news.ycombinator.com",
  "OpenAI":                  "https://openai.com/news",
  "Anthropic":               "https://www.anthropic.com/news",
  "AWS Machine Learning Blog": "https://aws.amazon.com/blogs/machine-learning/",
  "Hugging Face Blog":       "https://huggingface.co/blog",
  "Google AI Blog":          "https://blog.google/technology/ai/",
  "DeepMind Blog":           "https://deepmind.google/blog/",
  "Cohere Blog":             "https://cohere.com/blog",
  "LangChain Blog":          "https://blog.langchain.dev",
  "LlamaIndex Blog":         "https://www.llamaindex.ai/blog",
  "Pinecone Blog":           "https://www.pinecone.io/learn/",
  "Weaviate Blog":           "https://weaviate.io/blog",
  "Qdrant Blog":             "https://qdrant.tech/articles/",
  "VentureBeat AI":          "https://venturebeat.com/category/ai/",
  "The Gradient":            "https://thegradient.pub",
  "Simon Willison's Blog":   "https://simonwillison.net",
};

export interface CategoryMeta {
  id: string;
  label: string;
}

// Display order for category rows
export const CATEGORIES: CategoryMeta[] = [
  { id: "research", label: "Research & Community" },
  { id: "vendor",   label: "Vendor & Official" },
  { id: "media",    label: "Independent & Media" },
  { id: "more",     label: "More" },
];

export function getCategory(source: string): string {
  return SOURCE_CATEGORIES[source] ?? "more";
}

export function getSourceUrl(item: NewsItem): string | undefined {
  return item.source_url ?? SOURCE_URLS[item.source];
}

/**
 * Cap a newest-first sorted list to at most `perSource` items per source
 * and `maxTotal` items total. Used to prevent any single source from
 * dominating a category row.
 */
export function capRowItems(
  items: NewsItem[],
  perSource = 2,
  maxTotal = 10,
): NewsItem[] {
  const sourceCounts = new Map<string, number>();
  const result: NewsItem[] = [];
  for (const item of items) {
    if (result.length >= maxTotal) break;
    const count = sourceCounts.get(item.source) ?? 0;
    if (count < perSource) {
      result.push(item);
      sourceCounts.set(item.source, count + 1);
    }
  }
  return result;
}
