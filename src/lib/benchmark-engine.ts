// Pure benchmark logic — types, constants, and helpers shared by the benchmark
// state provider (which owns the run loop) and the BenchmarkRunner page (which
// renders derived aggregates). No React here; keeps the state owner and the
// consumer working off the same definitions.

import { type ApiMode, type ApiMatch, type ApiResponse } from "./api";

export const BENCHMARK_QUERIES = [
  "How do I give a Lambda function access to S3?",
  "What is the difference between Lambda URLs and API Gateway?",
  "How do I enable static website hosting on S3?",
  "How do I secure serverless endpoints on AWS?",
  "What is CloudFormation drift detection?",
  "How do I reduce IAM permissions safely?",
  "How do I set up a custom domain with CloudFront?",
];

export const MODES: ApiMode[] = ["flat", "hierarchical", "llm", "rag"];
export const MODE_LABELS: Record<ApiMode, string> = {
  flat: "Flat",
  hierarchical: "Hierarchical",
  llm: "LLM Only",
  rag: "RAG",
};

// Winner logic constants (documented here so the UI explanation stays in sync)
export const WINNER_QUALITY_EPSILON = 0.05; // modes within this quality range use latency as tiebreaker
export const WINNER_LATENCY_TIE_MS = 40;    // within this latency AND quality epsilon → "Tie"
export const REQUEST_DELAY_MS = 300;

export interface ModeSummary {
  confidence: number | null;
  qualityProxy: number | null;
  latencyMs: number;
  topTitles: string[];
  costUsd: number;
  tokens: number;
  answerText: string;
  matches: ApiMatch[];
  error: string | null;
  modelId: string | null;
}

export interface QueryResult {
  query: string;
  flat: ModeSummary;
  hierarchical: ModeSummary;
  llm: ModeSummary;
  rag: ModeSummary;
  winner: ApiMode | "tie" | "failed" | "skipped";
}

export interface RunRecord {
  startedAt: string;
  label: string;
  queryResults: QueryResult[];
}

export function buildSummary(data: ApiResponse, latencyMs: number): ModeSummary {
  return {
    confidence: data.confidence,
    qualityProxy: data.debug?.quality_proxy ?? null,
    latencyMs,
    topTitles: data.matches.slice(0, 3).map((m) => m.title || "Untitled"),
    costUsd: data.llm_stats?.cost_usd ?? 0,
    tokens: (data.llm_stats?.input_tokens ?? 0) + (data.llm_stats?.output_tokens ?? 0),
    answerText: data.answer_text ?? "",
    matches: data.matches.slice(0, 5),
    error: data.error,
    modelId: data.llm_stats?.model ?? null,
  };
}

export function decideWinner(results: Record<ApiMode, ModeSummary>): ApiMode | "tie" | "failed" {
  const valid = MODES.filter((m) => !results[m].error);
  if (valid.length === 0) return "failed";
  valid.sort((a, b) => {
    const qA = results[a].qualityProxy ?? -1;
    const qB = results[b].qualityProxy ?? -1;
    if (Math.abs(qA - qB) > WINNER_QUALITY_EPSILON) return qB - qA;
    return results[a].latencyMs - results[b].latencyMs;
  });
  if (valid.length >= 2) {
    const qDiff = Math.abs((results[valid[0]].qualityProxy ?? 0) - (results[valid[1]].qualityProxy ?? 0));
    const latDiff = Math.abs(results[valid[0]].latencyMs - results[valid[1]].latencyMs);
    if (qDiff <= WINNER_QUALITY_EPSILON && latDiff <= WINNER_LATENCY_TIE_MS) return "tie";
  }
  return valid[0];
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function newRunId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Empty per-mode summary used for errored/skipped modes. */
export function emptyModeSummary(): ModeSummary {
  return {
    confidence: null, qualityProxy: null, latencyMs: 0,
    topTitles: [], costUsd: 0, tokens: 0, answerText: "", matches: [], error: null,
    modelId: null,
  };
}
