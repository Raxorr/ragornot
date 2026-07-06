export type NewsTopic = "AI" | "LLM" | "RAG" | "Cost" | "Environment";

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string; // ISO 8601
  topic: NewsTopic;
  summary?: string;
}

export const newsTopics: Array<NewsTopic | "All"> = ["All", "AI", "LLM", "RAG", "Cost", "Environment"];
