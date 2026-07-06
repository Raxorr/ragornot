"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  callApi,
  checkBenchmarkQuota,
  uploadDocs,
  type ApiMode,
  type ApiError,
  type BenchmarkQuota,
} from "@/lib/api";
import { formatCost, formatLatency } from "@/lib/format";

const BENCHMARK_QUERIES = [
  "How do I give a Lambda function access to S3?",
  "What is the difference between Lambda URLs and API Gateway?",
  "How do I enable static website hosting on S3?",
  "How do I secure serverless endpoints on AWS?",
  "What is CloudFormation drift detection?",
  "How do I reduce IAM permissions safely?",
  "How do I set up a custom domain with CloudFront?",
];

const MODES: ApiMode[] = ["flat", "hierarchical", "llm", "rag"];
const MODE_LABELS: Record<ApiMode, string> = {
  flat: "Flat",
  hierarchical: "Hierarchical",
  llm: "LLM Only",
  rag: "RAG",
};

const WINNER_QUALITY_EPSILON = 0.05;
const REQUEST_DELAY_MS = 300;
const DAILY_LIMIT = 3;

interface ModeSummary {
  confidence: number | null;
  qualityProxy: number | null;
  latencyMs: number;
  topTitles: string[];
  costUsd: number;
  error: string | null;
}

interface QueryResult {
  query: string;
  flat: ModeSummary;
  hierarchical: ModeSummary;
  llm: ModeSummary;
  rag: ModeSummary;
  winner: ApiMode | "tie" | "failed" | "skipped";
}

interface RunRecord {
  startedAt: string;
  label: string;
  queryResults: QueryResult[];
}

function buildSummary(
  data: Awaited<ReturnType<typeof callApi>>["data"],
  latencyMs: number,
): ModeSummary {
  return {
    confidence: data.confidence,
    qualityProxy: data.debug?.quality_proxy ?? null,
    latencyMs,
    topTitles: data.matches.slice(0, 3).map((m) => m.title || "Untitled"),
    costUsd: data.llm_stats?.cost_usd ?? 0,
    error: data.error,
  };
}

function decideWinner(results: Record<ApiMode, ModeSummary>): ApiMode | "tie" | "failed" {
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
    if (qDiff <= WINNER_QUALITY_EPSILON && latDiff <= 40) return "tie";
  }
  return valid[0];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pct(v: number | null) {
  return v === null ? "—" : `${(v * 100).toFixed(0)}%`;
}

function avg(vals: number[]) {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function fmtCooldown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function newRunId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function BenchmarkRunner() {
  const [benchmarkKey, setBenchmarkKey] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<BenchmarkQuota | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  const abortRef = useRef(false);

  // Personal-docs state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [iterations, setIterations] = useState(1);
  const [usePersonalDocs, setUsePersonalDocs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cooldown ticker
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setTimeout(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  const refreshQuota = useCallback(async (key: string) => {
    if (!key.trim()) return;
    const result = await checkBenchmarkQuota(key.trim());
    if (result.ok && result.quota) {
      setQuota(result.quota);
      setCooldownSec(result.quota.seconds_until_next);
    }
  }, []);

  // Refresh quota when key changes (debounced)
  useEffect(() => {
    if (!benchmarkKey.trim()) { setQuota(null); return; }
    const t = setTimeout(() => { void refreshQuota(benchmarkKey); }, 600);
    return () => clearTimeout(t);
  }, [benchmarkKey, refreshQuota]);

  async function handleUpload() {
    if (uploadedFiles.length === 0) return;
    setUploading(true);
    setUploadStatus("Uploading and indexing…");
    try {
      const result = await uploadDocs(uploadedFiles);
      setSessionId(result.session_id);
      setUploadStatus(
        `Indexed ${result.total_chunks} chunks from ${result.files.filter((f) => f.status === "ok").length} file(s) — session expires in ${result.expires_in_hours}h`,
      );
    } catch (e) {
      setUploadStatus(`Upload failed: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function runBenchmark(iterCount = 1, sid: string | null = null) {
    if (!benchmarkKey.trim()) {
      setError("Enter your benchmark key to run.");
      return;
    }
    setRunning(true);
    setError(null);
    setResults([]);
    abortRef.current = false;

    const runId = newRunId();
    let lastQuotaInfo: BenchmarkQuota | null = null;

    for (let iter = 1; iter <= iterCount; iter++) {
      const runResults: QueryResult[] = [];
      let reqIdx = 0;

      for (let qi = 0; qi < BENCHMARK_QUERIES.length; qi++) {
        if (abortRef.current) break;
        const q = BENCHMARK_QUERIES[qi];
        const summaries: Partial<Record<ApiMode, ModeSummary>> = {};
        let skipped = false;

        for (const mode of MODES) {
          if (abortRef.current) break;
          const iterLabel = iterCount > 1 ? ` (run ${iter}/${iterCount})` : "";
          setProgress(
            `Query ${qi + 1}/${BENCHMARK_QUERIES.length} — ${MODE_LABELS[mode]}${iterLabel}`,
          );

          if (reqIdx > 0) await sleep(REQUEST_DELAY_MS);
          reqIdx++;

          try {
            const { data, latencyMs } = await callApi(q, mode, {
              benchmark: true,
              benchmarkKey: benchmarkKey.trim(),
              benchmarkMode: iterCount > 1 ? "x10" : "normal",
              runId,
              ...(sid ? { sessionId: sid } : {}),
            });
            summaries[mode] = buildSummary(data, latencyMs);
            if (data.quota) lastQuotaInfo = data.quota;
          } catch (err) {
            const apiErr = err as ApiError;
            if (apiErr.rateLimited) {
              const wait = apiErr.retryAfterSeconds ?? 2;
              setProgress(`Rate-limited — waiting ${wait}s`);
              await sleep(wait * 1000);
              summaries[mode] = {
                confidence: null,
                qualityProxy: null,
                latencyMs: 0,
                topTitles: [],
                costUsd: 0,
                error: "rate_limited",
              };
              skipped = true;
            } else {
              summaries[mode] = {
                confidence: null,
                qualityProxy: null,
                latencyMs: 0,
                topTitles: [],
                costUsd: 0,
                error: apiErr.message,
              };
            }
          }
        }

        const complete = summaries as Record<ApiMode, ModeSummary>;
        const winner = skipped ? "skipped" : decideWinner(complete);
        runResults.push({ query: q, ...complete, winner });
        setResults([...runResults]);
      }

      const label = sid
        ? `Personal docs — run ${iter}/${iterCount}`
        : iterCount > 1
          ? `Run ${iter}/${iterCount}`
          : "Standard run";
      setHistory((prev) => [
        ...prev,
        { startedAt: new Date().toISOString(), label, queryResults: runResults },
      ]);
    }

    if (lastQuotaInfo) {
      setQuota(lastQuotaInfo);
      setCooldownSec(lastQuotaInfo.seconds_until_next);
    } else {
      await refreshQuota(benchmarkKey);
    }

    setRunning(false);
    setProgress("");
  }

  function stop() {
    abortRef.current = true;
    setProgress("Stopping after current request…");
  }

  function downloadJson() {
    const allLatencies = {
      flat: [] as number[],
      hierarchical: [] as number[],
      llm: [] as number[],
      rag: [] as number[],
    };
    const winCounts = { flat: 0, hierarchical: 0, llm: 0, rag: 0, tie: 0 };
    for (const run of history) {
      for (const r of run.queryResults) {
        for (const m of MODES) {
          if (!r[m].error && r[m].latencyMs > 0) allLatencies[m].push(r[m].latencyMs);
        }
        if (r.winner !== "failed" && r.winner !== "skipped")
          winCounts[r.winner as keyof typeof winCounts]++;
        if (r.winner === "tie") winCounts.tie++;
      }
    }
    const payload = {
      exported_at: new Date().toISOString(),
      query_list: BENCHMARK_QUERIES,
      summary: {
        run_count: history.length,
        avg_flat_latency: avg(allLatencies.flat),
        avg_hier_latency: avg(allLatencies.hierarchical),
        avg_llm_latency: avg(allLatencies.llm),
        avg_rag_latency: avg(allLatencies.rag),
        win_counts: winCounts,
      },
      history,
      quota,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `benchmark-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const canRun =
    !running &&
    !!benchmarkKey.trim() &&
    (quota === null || (quota.remaining_runs > 0 && cooldownSec === 0));

  const allLatencies = {
    flat: [] as number[],
    hierarchical: [] as number[],
    llm: [] as number[],
    rag: [] as number[],
  };
  const allConfidences = { flat: [] as number[], hierarchical: [] as number[] };
  const winCounts = { flat: 0, hierarchical: 0, llm: 0, rag: 0, tie: 0 };
  for (const r of results) {
    for (const mode of MODES) {
      if (!r[mode].error && r[mode].latencyMs > 0) allLatencies[mode].push(r[mode].latencyMs);
      if ((mode === "flat" || mode === "hierarchical") && r[mode].confidence !== null)
        allConfidences[mode].push(r[mode].confidence!);
    }
    if (r.winner !== "failed" && r.winner !== "skipped")
      winCounts[r.winner as keyof typeof winCounts]++;
    if (r.winner === "tie") winCounts.tie++;
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h2 id="benchmark-heading" className="text-2xl font-bold tracking-tight text-text">
          Live Benchmark
        </h2>
        <p className="max-w-prose text-sm text-text-muted">
          Runs {BENCHMARK_QUERIES.length} queries through all four modes against the live AWS Lambda
          backend. Rate limits are enforced server-side: {DAILY_LIMIT} runs per day per IP, with a
          1-hour gap between runs.
        </p>
      </div>

      {/* Benchmark key input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="bm-key" className="text-sm font-medium text-text">
          Benchmark key
        </label>
        <input
          id="bm-key"
          type="password"
          value={benchmarkKey}
          onChange={(e) => setBenchmarkKey(e.target.value)}
          placeholder="Enter key to unlock benchmark"
          className="w-full max-w-sm rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-focus"
          disabled={running}
          autoComplete="off"
        />

        {/* Quota status */}
        {quota && (
          <p className="text-xs text-text-muted">
            {quota.remaining_runs > 0 ? (
              <>
                <span className="font-medium text-text">{quota.remaining_runs}</span> of{" "}
                {quota.daily_limit} runs left today
                {cooldownSec > 0 && (
                  <>
                    {" "}
                    · next run in{" "}
                    <span className="font-medium text-text">{fmtCooldown(cooldownSec)}</span>
                  </>
                )}
              </>
            ) : (
              <span className="text-accent-text">
                Daily limit reached ({quota.daily_limit}/{quota.daily_limit} runs). Resets at
                midnight UTC.
              </span>
            )}
          </p>
        )}
      </div>

      {/* Run controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!running ? (
          <button
            type="button"
            onClick={() =>
              void runBenchmark(
                usePersonalDocs ? iterations : 1,
                usePersonalDocs ? sessionId : null,
              )
            }
            disabled={!canRun || (usePersonalDocs && !sessionId)}
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {usePersonalDocs ? `Run on Personal Docs (×${iterations})` : "Run Benchmark"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 font-medium text-text transition-colors hover:bg-surface-2"
          >
            Stop
          </button>
        )}
        {history.length > 0 && (
          <button
            type="button"
            onClick={downloadJson}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2"
          >
            Download JSON
          </button>
        )}
        {progress && <p className="text-sm text-text-muted">{progress}</p>}
      </div>

      {/* Disabled-run explanation */}
      {!running && quota && quota.remaining_runs === 0 && (
        <p className="text-sm text-accent-text">
          Daily benchmark limit reached. Runs reset at midnight UTC.
        </p>
      )}
      {!running && quota && quota.remaining_runs > 0 && cooldownSec > 0 && (
        <p className="text-sm text-text-muted">
          Next run available in <span className="font-medium">{fmtCooldown(cooldownSec)}</span> (1-hour
          cooldown between runs).
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-border px-4 py-3 text-sm text-accent-text">
          {error}
        </div>
      )}

      {/* Personal-docs section */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <input
            id="use-personal"
            type="checkbox"
            checked={usePersonalDocs}
            onChange={(e) => setUsePersonalDocs(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <label htmlFor="use-personal" className="text-sm font-medium text-text">
            Benchmark against my own uploaded docs
          </label>
        </div>

        {usePersonalDocs && (
          <div className="flex flex-col gap-3 pl-7">
            <p className="text-xs text-text-muted">
              Upload your PDFs/TXTs (max 5 files, 10 MB each). The benchmark will search your docs
              instead of the system corpus. Counts as one run against the daily cap.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface-2"
                disabled={uploading || running}
              >
                Select files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.csv,.html,.htm,.json"
                className="hidden"
                onChange={(e) => {
                  const chosen = Array.from(e.target.files ?? []);
                  setUploadedFiles(chosen);
                  setSessionId(null);
                  setUploadStatus("");
                }}
              />
              {uploadedFiles.length > 0 && (
                <span className="text-sm text-text-muted">
                  {uploadedFiles.map((f) => f.name).join(", ")}
                </span>
              )}
              {uploadedFiles.length > 0 && !sessionId && (
                <button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={uploading || running}
                  className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                >
                  {uploading ? "Uploading…" : "Upload & Index"}
                </button>
              )}
            </div>

            {uploadStatus && (
              <p className="text-xs text-text-muted">{uploadStatus}</p>
            )}

            {sessionId && (
              <div className="flex items-center gap-3">
                <label htmlFor="iter-count" className="text-sm text-text">
                  Iterations (1–10):
                </label>
                <input
                  id="iter-count"
                  type="number"
                  min={1}
                  max={10}
                  value={iterations}
                  onChange={(e) => setIterations(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
                  disabled={running}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Aggregate stats */}
      {results.length > 0 && (
        <>
          <section
            aria-labelledby="agg-heading"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
          >
            <h3 id="agg-heading" className="mb-4 text-lg font-bold text-text">
              Aggregate ({results.length} queries)
            </h3>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm sm:grid-cols-4">
              {MODES.map((mode) => (
                <div key={mode} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {MODE_LABELS[mode]}
                  </span>
                  <span className="text-text">
                    avg {formatLatency(avg(allLatencies[mode]) ?? 0)}
                  </span>
                  {(mode === "flat" || mode === "hierarchical") && (
                    <span className="text-text">
                      avg conf {pct(avg(allConfidences[mode]))}
                    </span>
                  )}
                  <span className="font-semibold text-accent-text">{winCounts[mode]} wins</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-muted">Ties: {winCounts.tie}</p>
          </section>

          <section aria-label="Per-query results" className="flex flex-col gap-6">
            {results.map((r) => (
              <article
                key={r.query}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-text">{r.query}</h3>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                      r.winner === "failed" || r.winner === "skipped"
                        ? "bg-surface-2 text-text-muted"
                        : r.winner === "tie"
                          ? "border border-border text-text-muted"
                          : "bg-accent text-white"
                    }`}
                  >
                    {r.winner === "failed"
                      ? "Failed"
                      : r.winner === "skipped"
                        ? "Skipped (rate-limited)"
                        : r.winner === "tie"
                          ? "Tie"
                          : `Winner: ${MODE_LABELS[r.winner as ApiMode]}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {MODES.map((mode) => {
                    const s = r[mode];
                    return (
                      <div
                        key={mode}
                        className="flex flex-col gap-1 rounded-md border border-border bg-surface-2 p-3"
                      >
                        <span className="text-xs font-semibold text-text-muted">
                          {MODE_LABELS[mode]}
                        </span>
                        {s.error ? (
                          <span className="text-xs text-accent-text">{s.error}</span>
                        ) : (
                          <>
                            <span className="font-mono text-xs text-text">
                              {formatLatency(s.latencyMs)}
                            </span>
                            {s.confidence !== null && (
                              <span className="font-mono text-xs text-text">
                                conf {pct(s.confidence)}
                              </span>
                            )}
                            {s.qualityProxy !== null && (
                              <span className="font-mono text-xs text-text">
                                quality {pct(s.qualityProxy)}
                              </span>
                            )}
                            {s.costUsd > 0 && (
                              <span className="font-mono text-xs text-text">
                                {formatCost(s.costUsd)}
                              </span>
                            )}
                            {s.topTitles.length > 0 && (
                              <span className="text-xs leading-tight text-text-muted">
                                {s.topTitles.slice(0, 2).join(", ")}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
