import type { RetrievalMode } from "./config";

export interface BenchmarkRow {
  mode: RetrievalMode;
  label: string;
  relevancePct: number;
  latencyMs: number;
  costPerQueryUsd: number;
  energyPerQueryWh: number;
  notes: string;
}

// Illustrative numbers from running the demo corpus's example queries through
// each mode (Flat/Hierarchical measured; LLM-only/RAG simulated — see
// src/lib/search.ts). The point isn't precision, it's the shape of the
// tradeoff: retrieval is nearly free, generation is where cost shows up, and
// grounding is where retrieval relevance shows up. Note: relevancePct is the
// retrieval-confidence (lexical match) proxy, NOT answer correctness.
export const benchmarkRows: BenchmarkRow[] = [
  {
    mode: "flat",
    label: "Flat (Lexical)",
    relevancePct: 71,
    latencyMs: 6,
    costPerQueryUsd: 0,
    energyPerQueryWh: 0.0006,
    notes: "Fast and free, but a single global ranking can surface off-topic chunks from unrelated docs.",
  },
  {
    mode: "hierarchical",
    label: "Hierarchical",
    relevancePct: 79,
    latencyMs: 11,
    costPerQueryUsd: 0,
    energyPerQueryWh: 0.0009,
    notes: "Narrowing to top documents first improves precision over Flat at a small extra compute cost.",
  },
  {
    mode: "llm-only",
    label: "LLM-only",
    relevancePct: 53,
    latencyMs: 690,
    costPerQueryUsd: 0.00013,
    energyPerQueryWh: 0.34,
    notes: "No grounding — fluent, but frequently generic or wrong on service-specific details.",
  },
  {
    mode: "rag",
    label: "RAG",
    relevancePct: 91,
    latencyMs: 860,
    costPerQueryUsd: 0.00041,
    energyPerQueryWh: 0.41,
    notes: "Retrieval grounds the answer before generation — highest retrieval relevance, but the slowest and priciest mode.",
  },
];
