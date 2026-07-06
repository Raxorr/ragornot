"use client";

import { useState, useRef } from "react";
import { callApi, type ApiMode, type ApiError } from "@/lib/api";
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

function buildSummary(data: Awaited<ReturnType<typeof callApi>>["data"], latencyMs: number): ModeSummary {
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

export default function BenchmarkRunner() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  async function runBenchmark() {
    setRunning(true);
    setError(null);
    setResults([]);
    abortRef.current = false;
    const runResults: QueryResult[] = [];
    let reqIdx = 0;

    for (let qi = 0; qi < BENCHMARK_QUERIES.length; qi++) {
      if (abortRef.current) break;
      const q = BENCHMARK_QUERIES[qi];
      const summaries: Partial<Record<ApiMode, ModeSummary>> = {};
      let skipped = false;

      for (const mode of MODES) {
        if (abortRef.current) break;
        setProgress(`Query ${qi + 1}/${BENCHMARK_QUERIES.length} — ${MODE_LABELS[mode]}`);

        if (reqIdx > 0) await sleep(REQUEST_DELAY_MS);
        reqIdx++;

        try {
          const { data, latencyMs } = await callApi(q, mode, { benchmark: true, benchmarkMode: "normal" });
          summaries[mode] = buildSummary(data, latencyMs);
        } catch (err) {
          const apiErr = err as ApiError;
          if (apiErr.rateLimited) {
            const wait = apiErr.retryAfterSeconds ?? 2;
            setProgress(`Rate-limited — waiting ${wait}s then continuing`);
            await sleep(wait * 1000);
            summaries[mode] = { confidence: null, qualityProxy: null, latencyMs: 0, topTitles: [], costUsd: 0, error: "rate_limited" };
            skipped = true;
          } else {
            summaries[mode] = { confidence: null, qualityProxy: null, latencyMs: 0, topTitles: [], costUsd: 0, error: apiErr.message };
          }
        }
      }

      const complete = summaries as Record<ApiMode, ModeSummary>;
      const winner = skipped ? "skipped" : decideWinner(complete);
      const qr: QueryResult = { query: q, ...complete, winner };
      runResults.push(qr);
      setResults([...runResults]);
    }

    setRunning(false);
    setProgress("");
  }

  function stop() {
    abortRef.current = true;
    setProgress("Stopping after current request…");
  }

  const allLatencies = { flat: [] as number[], hierarchical: [] as number[], llm: [] as number[], rag: [] as number[] };
  const allConfidences = { flat: [] as number[], hierarchical: [] as number[] };
  const winCounts = { flat: 0, hierarchical: 0, llm: 0, rag: 0, tie: 0 };

  for (const r of results) {
    for (const mode of MODES) {
      if (!r[mode].error && r[mode].latencyMs > 0) allLatencies[mode].push(r[mode].latencyMs);
      if ((mode === "flat" || mode === "hierarchical") && r[mode].confidence !== null) {
        allConfidences[mode].push(r[mode].confidence!);
      }
    }
    if (r.winner !== "failed" && r.winner !== "skipped") winCounts[r.winner]++;
    if (r.winner === "tie") winCounts.tie++;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 id="benchmark-heading" className="text-2xl font-bold tracking-tight text-text">
          Live Benchmark
        </h2>
        <p className="max-w-prose text-sm text-text-muted">
          Runs {BENCHMARK_QUERIES.length} queries through all four modes against the live AWS Lambda backend.
          Each request counts against the per-IP daily limit. Rate limits are respected automatically.
        </p>

        <div className="flex items-center gap-3">
          {!running ? (
            <button
              type="button"
              onClick={() => void runBenchmark()}
              className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Run Benchmark
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
          {progress && <p className="text-sm text-text-muted">{progress}</p>}
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-border px-4 py-3 text-sm text-accent-text">
            {error}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <>
          <section aria-labelledby="agg-heading" className="rounded-lg border border-border bg-surface p-5 sm:p-6">
            <h3 id="agg-heading" className="mb-4 text-lg font-bold text-text">Aggregate ({results.length} queries)</h3>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm sm:grid-cols-4">
              {MODES.map((mode) => (
                <div key={mode} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{MODE_LABELS[mode]}</span>
                  <span className="text-text">
                    avg {formatLatency(avg(allLatencies[mode]) ?? 0)}
                  </span>
                  {(mode === "flat" || mode === "hierarchical") && (
                    <span className="text-text">
                      avg conf {pct(avg(allConfidences[mode]))}
                    </span>
                  )}
                  <span className="text-accent-text font-semibold">
                    {winCounts[mode]} wins
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-muted">Ties: {winCounts.tie}</p>
          </section>

          <section aria-label="Per-query results" className="flex flex-col gap-6">
            {results.map((r) => (
              <article key={r.query} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-text">{r.query}</h3>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                    r.winner === "failed" ? "bg-surface-2 text-text-muted" :
                    r.winner === "skipped" ? "bg-surface-2 text-text-muted" :
                    r.winner === "tie" ? "border border-border text-text-muted" :
                    "bg-accent text-white"
                  }`}>
                    {r.winner === "failed" ? "Failed" :
                     r.winner === "skipped" ? "Skipped (rate-limited)" :
                     r.winner === "tie" ? "Tie" :
                     `Winner: ${MODE_LABELS[r.winner]}`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {MODES.map((mode) => {
                    const s = r[mode];
                    return (
                      <div key={mode} className="flex flex-col gap-1 rounded-md border border-border bg-surface-2 p-3">
                        <span className="text-xs font-semibold text-text-muted">{MODE_LABELS[mode]}</span>
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
                              <span className="text-xs text-text-muted leading-tight">
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
