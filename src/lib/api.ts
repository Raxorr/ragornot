const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const API_PATH = "/api/search";
const API_URL = `${API_BASE}${API_PATH}`;

export type ApiMode = "flat" | "hierarchical" | "llm" | "rag";

export interface ApiMatch {
  title: string;
  heading: string | null;
  snippet: string;
  url: string;
}

export interface ApiLlmStats {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  model: string;
}

export interface ApiDebug {
  quality_proxy?: number;
  final_chunk_ids?: string[];
  final_chunk_count?: number;
  top_sections?: Array<{ heading: string }>;
  mode?: string;
  retrieval_latency_ms?: number;
  total_scored_chunks?: number;
}

export interface ApiResponse {
  query: string;
  mode: ApiMode;
  answer_text: string;
  answer_bullets: string[];
  matches: ApiMatch[];
  confidence: number | null;
  error: string | null;
  debug: ApiDebug;
  llm_stats: ApiLlmStats | null;
  retrieval_stats: Record<string, unknown> | null;
  remaining?: number;
  expires_in_hours?: number;
}

export interface ApiError extends Error {
  status: number;
  rateLimited: boolean;
  retryAfterSeconds?: number;
}

export interface CallResult {
  data: ApiResponse;
  latencyMs: number;
}

interface CallOptions {
  benchmark?: boolean;
  benchmarkKey?: string;
  benchmarkMode?: "normal" | "x10";
}

export async function callApi(
  q: string,
  mode: ApiMode,
  options: CallOptions = {},
): Promise<CallResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const body: Record<string, unknown> = { q, mode };

  if (options.benchmark) {
    body.benchmark = true;
    body.benchmark_mode = options.benchmarkMode ?? "normal";
    if (options.benchmarkKey) {
      headers["X-Benchmark-Key"] = options.benchmarkKey;
    }
    headers["X-Benchmark-Mode"] = options.benchmarkMode ?? "normal";
  }

  const started = performance.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const latencyMs = performance.now() - started;

  const raw = await res.json() as ApiResponse;

  if (!res.ok) {
    const err = new Error(raw.error ?? `Request failed (${res.status})`) as ApiError;
    err.status = res.status;
    err.rateLimited = res.status === 429;
    const retryHeader = res.headers.get("Retry-After");
    if (retryHeader) {
      const parsed = parseInt(retryHeader, 10);
      if (!isNaN(parsed)) err.retryAfterSeconds = parsed;
    }
    const rawAny = raw as unknown as Record<string, unknown>;
    if (typeof rawAny.retry_after_seconds === "number") {
      err.retryAfterSeconds = rawAny.retry_after_seconds;
    }
    throw err;
  }

  return { data: raw, latencyMs };
}

export async function checkBenchmarkQuota(
  benchmarkMode: "normal" | "x10",
  benchmarkKey: string,
): Promise<{ ok: boolean; remaining?: number; error?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Benchmark-Key": benchmarkKey,
    "X-Benchmark-Mode": benchmarkMode,
  };
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ benchmark: true, quota_check: true, benchmark_mode: benchmarkMode }),
    });
    const data = await res.json() as { remaining?: number; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `Quota check failed (${res.status})` };
    return { ok: true, remaining: data.remaining };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Quota check failed." };
  }
}
