// Central place for copy and numbers that show up verbatim in the UI.
// Change a stat here and it updates everywhere it's rendered.

export const site = {
  name: "ragornot",
  eyebrow: "RAG OR NOT — COMPARE. LEARN. DECIDE.",
  heroTitle: "ragornot",
  heroSubtitle:
    "Compare retrieval architectures, track real cost and latency, and follow the AI, LLM, and RAG conversation — in one place.",
  author: "Rohit Sarna",
  githubUrl: "https://github.com/Raxorr",
  linkedinUrl: "https://www.linkedin.com/in/rohitsarna",
} as const;

export const navTabs = [
  { href: "/news", label: "News" },
  { href: "/explore", label: "Explore" },
  { href: "/benchmark", label: "Benchmark" },
] as const;

// Stat strip on the Assistant tab. Kept as plain data so the numbers can be
// swapped (or wired to a real index/benchmark run) without touching markup.
export const assistantStats = [
  { label: "docs indexed", value: "116" },
  { label: "retrieval modes", value: "4" },
  { label: "avg latency", value: "<200ms" },
  { label: "LLM calls", value: "0" },
] as const;

export const exampleQueries = [
  "Lambda function URL",
  "S3 static hosting",
  "IAM for Lambda",
  "API Gateway + Lambda",
] as const;

export type RetrievalMode = "flat" | "hierarchical" | "llm-only" | "rag";

export const retrievalModes: Array<{
  id: RetrievalMode;
  label: string;
  description: string;
}> = [
  {
    id: "flat",
    label: "Flat (Lexical)",
    description: "Ranks every chunk in the index directly against the query — a single global BM25-style pass.",
  },
  {
    id: "hierarchical",
    label: "Hierarchical",
    description: "Narrows document → section → chunk before ranking, trading a little latency for more precise context.",
  },
  {
    id: "llm-only",
    label: "LLM-only",
    description: "No retrieval step — answers from the model's parametric memory alone. Fast, but ungrounded.",
  },
  {
    id: "rag",
    label: "RAG",
    description: "Retrieves grounding context first, then generates an answer from it — the full retrieval-augmented pipeline.",
  },
];
