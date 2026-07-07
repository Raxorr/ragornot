export type NewsTopic = "AI" | "LLM" | "RAG" | "Cost" | "Environment";

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  source_url?: string;
  url: string;
  publishedAt: string; // ISO 8601
  topic: NewsTopic;
  summary?: string;
  imageUrl?: string;
}

export const newsTopics: Array<NewsTopic | "All"> = ["All", "AI", "LLM", "RAG", "Cost", "Environment"];
