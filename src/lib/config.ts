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
  { href: "/benchmark", label: "Benchmark" },
  { href: "/explore", label: "Explore" },
  { href: "/decide", label: "Decide" },
  { href: "/news", label: "News" },
  { href: "/digest", label: "Digest" },
  { href: "/wall", label: "In the Wild" },
] as const;

// Genuinely-static facts for the Explore hero stat strip. The other two stats
// (avg latency, LLM calls) are session-scoped and computed live from real runs
// — see ExploreStatsContext / StatStrip — so they can't drift into false claims.
export const assistantStats = [
  { label: "docs indexed", value: "116" },
  { label: "retrieval modes", value: "4" },
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
