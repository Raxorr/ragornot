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

export interface BenchmarkQuota {
  remaining_runs: number;
  runs_used: number;
  daily_limit: number;
  seconds_until_next: number;
  next_run_allowed: boolean;
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
  quota?: BenchmarkQuota;
  retry_after_seconds?: number;
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
  runId?: string;
  sessionId?: string;
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
    if (options.runId) body.run_id = options.runId;
  }
  if (options.sessionId) body.session_id = options.sessionId;

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
    if (typeof raw.retry_after_seconds === "number") {
      err.retryAfterSeconds = raw.retry_after_seconds;
    }
    throw err;
  }

  return { data: raw, latencyMs };
}

// Quota check is open to all — no benchmark key required.
export async function checkBenchmarkQuota(): Promise<{ ok: boolean; quota?: BenchmarkQuota; error?: string }> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ benchmark: true, quota_check: true }),
    });
    const data = await res.json() as { quota?: BenchmarkQuota; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `Quota check failed (${res.status})` };
    return { ok: true, quota: data.quota };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Quota check failed." };
  }
}

export async function submitBenchmarkInterest(
  email: string,
  name?: string,
  note?: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/benchmark-interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name ?? "", note: note ?? "" }),
    });
    const data = await res.json() as { success?: boolean; message?: string; error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? `Request failed (${res.status})` };
    return { ok: true, message: data.message };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Submission failed." };
  }
}

const UPLOAD_URL = `${API_BASE}/api/upload`;

export interface UploadResult {
  session_id: string;
  total_chunks: number;
  expires_in_hours: number;
  files: Array<{ name: string; status: string; chunks?: number; reason?: string }>;
}

export async function uploadDocs(files: File[]): Promise<UploadResult> {
  const filesPayload: Array<{ name: string; content: string }> = [];
  for (const file of files) {
    const b64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    filesPayload.push({ name: file.name, content: b64 });
  }
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: filesPayload }),
  });
  const data = await res.json() as UploadResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data;
}
