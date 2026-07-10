"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  callApi,
  checkBenchmarkQuota,
  uploadDocs,
  submitBenchmarkInterest,
  type ApiMode,
  type ApiMatch,
  type ApiError,
  type BenchmarkQuota,
} from "@/lib/api";
import { formatCost, formatLatency } from "@/lib/format";
import { benchmarkRows, type BenchmarkRow } from "@/lib/benchmark-data";
import type { RetrievalMode } from "@/lib/config";
import ComparisonTable from "./ComparisonTable";
import ImpactAnalytics from "@/components/news/ImpactAnalytics";
import ImpactPanel from "@/components/impact/ImpactPanel";
import { flags } from "@/lib/flags";
import { useSessionImpact } from "@/lib/session-impact";
import ModeIntro from "./ModeIntro";
import InfoTooltip from "@/components/ui/InfoTooltip";

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

// Winner logic constants (documented here so the UI explanation stays in sync)
const WINNER_QUALITY_EPSILON = 0.05; // modes within this quality range use latency as tiebreaker
const WINNER_LATENCY_TIE_MS = 40;    // within this latency AND quality epsilon → "Tie"
const REQUEST_DELAY_MS = 300;

interface ModeSummary {
  confidence: number | null;
  qualityProxy: number | null;
  latencyMs: number;
  topTitles: string[];
  costUsd: number;
  tokens: number;
  answerText: string;
  matches: ApiMatch[];
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
    tokens: (data.llm_stats?.input_tokens ?? 0) + (data.llm_stats?.output_tokens ?? 0),
    answerText: data.answer_text ?? "",
    matches: data.matches.slice(0, 5),
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
    if (qDiff <= WINNER_QUALITY_EPSILON && latDiff <= WINNER_LATENCY_TIE_MS) return "tie";
  }
  return valid[0];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pct(v: number | null) {
  return v === null ? "—" : `${(v * 100).toFixed(0)}%`;
}

function avg(vals: number[]): number | null {
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

/**
 * Compute per-mode aggregate rows from live benchmark results.
 * LLM-only rarely wins because it has no qualityProxy (BM25 score) — see winner logic.
 * Energy for LLM/RAG is derived from cost using ~2615 Wh/$ (calibrated to static demo data).
 * Flat/Hierarchical use the static near-zero energy figures (in-Lambda BM25, negligible GPU).
 */
function computeLiveRows(results: QueryResult[]): BenchmarkRow[] {
  return MODES.map((mode) => {
    const valid = results.filter((r) => !r[mode].error && r[mode].latencyMs > 0);
    const avgLatency = avg(valid.map((r) => r[mode].latencyMs)) ?? 0;
    const avgCost = avg(valid.map((r) => r[mode].costUsd)) ?? 0;
    const confs = valid.map((r) => r[mode].confidence).filter((c): c is number => c !== null);
    const avgConf = confs.length ? avg(confs) : null;
    const energyPerQueryWh =
      mode === "llm" || mode === "rag"
        ? avgCost * 2615
        : mode === "hierarchical"
          ? 0.0009
          : 0.0006;
    const staticRow = benchmarkRows.find(
      (r) => r.mode === (mode === "llm" ? "llm-only" : mode),
    );
    return {
      mode: (mode === "llm" ? "llm-only" : mode) as RetrievalMode,
      label: MODE_LABELS[mode],
      accuracyPct:
        avgConf !== null ? Math.round(avgConf * 100) : (staticRow?.accuracyPct ?? 0),
      latencyMs: Math.round(avgLatency),
      costPerQueryUsd: avgCost,
      energyPerQueryWh,
      notes: staticRow?.notes ?? "",
    };
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCsv(results: QueryResult[]) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const lines: string[] = [
    "query,mode,latency_ms,confidence,quality_proxy,cost_usd,tokens,is_winner",
  ];
  for (const r of results) {
    for (const mode of MODES) {
      const s = r[mode];
      lines.push(
        [
          `"${r.query.replace(/"/g, '""')}"`,
          mode,
          s.error ? "" : s.latencyMs,
          s.confidence !== null ? s.confidence.toFixed(4) : "",
          s.qualityProxy !== null ? s.qualityProxy.toFixed(4) : "",
          s.costUsd.toFixed(8),
          s.tokens,
          r.winner === mode ? "true" : "false",
        ].join(","),
      );
    }
  }
  lines.push("");
  lines.push("# per-mode averages");
  lines.push("mode,avg_latency_ms,avg_confidence,avg_cost_usd,avg_tokens,win_count,tie_count");
  const ties = results.filter((r) => r.winner === "tie").length;
  for (const mode of MODES) {
    const valid = results.filter((r) => !r[mode].error && r[mode].latencyMs > 0);
    const confs = valid.map((r) => r[mode].confidence).filter((c): c is number => c !== null);
    lines.push(
      [
        mode,
        Math.round(avg(valid.map((r) => r[mode].latencyMs)) ?? 0),
        (avg(confs) ?? 0).toFixed(4),
        (avg(valid.map((r) => r[mode].costUsd)) ?? 0).toFixed(8),
        Math.round(avg(valid.map((r) => r[mode].tokens)) ?? 0),
        results.filter((r) => r.winner === mode).length,
        ties,
      ].join(","),
    );
  }
  triggerDownload(new Blob([lines.join("\n")], { type: "text/csv" }), `benchmark-${ts}.csv`);
}

function downloadJson(results: QueryResult[], history: RunRecord[]) {
  const allLatencies: Record<ApiMode, number[]> = {
    flat: [], hierarchical: [], llm: [], rag: [],
  };
  const winCounts: Record<string, number> = { flat: 0, hierarchical: 0, llm: 0, rag: 0, tie: 0 };
  for (const r of results) {
    for (const m of MODES) {
      if (!r[m].error && r[m].latencyMs > 0) allLatencies[m].push(r[m].latencyMs);
    }
    if (r.winner !== "failed" && r.winner !== "skipped")
      winCounts[r.winner]++;
  }
  // Pick model id from first available llm_stats
  let modelId = "";
  outer: for (const r of results) {
    for (const m of ["llm", "rag"] as ApiMode[]) {
      if (!r[m].error && r[m].tokens > 0) { modelId = ""; break outer; }
    }
  }
  const ts = new Date().toISOString();
  const payload = {
    exported_at: ts,
    run_metadata: {
      timestamp: ts,
      query_count: results.length,
      model_id: modelId || "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      winner_logic: `highest qualityProxy (BM25 score); within ${WINNER_QUALITY_EPSILON * 100}% quality uses latency; within ${WINNER_QUALITY_EPSILON * 100}% quality AND ${WINNER_LATENCY_TIE_MS}ms → Tie; LLM-only has no qualityProxy (=-1) so rarely wins`,
    },
    query_list: BENCHMARK_QUERIES,
    summary: {
      run_count: history.length,
      avg_latency: Object.fromEntries(
        MODES.map((m) => [m, avg(allLatencies[m])]),
      ),
      win_counts: winCounts,
    },
    results: results.map((r) => ({
      query: r.query,
      winner: r.winner,
      ...Object.fromEntries(
        MODES.map((m) => [
          m,
          {
            latency_ms: r[m].latencyMs,
            confidence: r[m].confidence,
            quality_proxy: r[m].qualityProxy,
            cost_usd: r[m].costUsd,
            tokens: r[m].tokens,
            answer_text: r[m].answerText,
            matches: r[m].matches,
            error: r[m].error,
          },
        ]),
      ),
    })),
  };
  const fname = `benchmark-${ts.replace(/[:.]/g, "-")}.json`;
  triggerDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    fname,
  );
}

export default function BenchmarkRunner() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<BenchmarkQuota | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  const abortRef = useRef(false);
  const sessionImpact = useSessionImpact();

  const [advancedKey, setAdvancedKey] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [iterations, setIterations] = useState(1);
  const [usePersonalDocs, setUsePersonalDocs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [interestEmail, setInterestEmail] = useState("");
  const [interestName, setInterestName] = useState("");
  const [interestNote, setInterestNote] = useState("");
  const [interestStatus, setInterestStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [interestMsg, setInterestMsg] = useState("");

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setTimeout(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  const refreshQuota = useCallback(async () => {
    const result = await checkBenchmarkQuota();
    if (result.ok && result.quota) {
      setQuota(result.quota);
      setCooldownSec(result.quota.seconds_until_next);
    }
  }, []);

  // On mount, load the benchmark quota. The setState calls happen inside
  // refreshQuota after an awaited fetch — not synchronously — so this is a
  // legitimate external-data sync, not the cascading-render pattern the rule
  // guards against.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refreshQuota(); }, [refreshQuota]);

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
    setRunning(true);
    setError(null);
    setResults([]);
    abortRef.current = false;

    const runId = newRunId();
    let lastQuotaInfo: BenchmarkQuota | null = null;
    const emptyModeSummary = (): ModeSummary => ({
      confidence: null, qualityProxy: null, latencyMs: 0,
      topTitles: [], costUsd: 0, tokens: 0, answerText: "", matches: [], error: null,
    });

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
          setProgress(`Query ${qi + 1}/${BENCHMARK_QUERIES.length} — ${MODE_LABELS[mode]}${iterLabel}`);

          if (reqIdx > 0) await sleep(REQUEST_DELAY_MS);
          reqIdx++;

          const options = sid
            ? {
                benchmark: true,
                benchmarkKey: advancedKey.trim(),
                benchmarkMode: iterCount > 1 ? "x10" as const : "normal" as const,
                runId,
                sessionId: sid,
              }
            : { benchmark: true, benchmarkMode: "normal" as const, runId };

          try {
            const { data, latencyMs } = await callApi(q, mode, options);
            summaries[mode] = buildSummary(data, latencyMs);
            // Feed the session self-consumption meter with this run's real tokens.
            if (flags.sessionMeter) {
              const tokens = (data.llm_stats?.input_tokens ?? 0) + (data.llm_stats?.output_tokens ?? 0);
              sessionImpact?.record(mode, tokens, data.llm_stats?.cost_usd ?? 0, latencyMs);
            }
            if (data.quota) lastQuotaInfo = data.quota;
          } catch (err) {
            const apiErr = err as ApiError;
            if (apiErr.rateLimited) {
              const wait = apiErr.retryAfterSeconds ?? 2;
              setProgress(`Rate-limited — waiting ${wait}s`);
              await sleep(wait * 1000);
              summaries[mode] = { ...emptyModeSummary(), error: "rate_limited" };
              skipped = true;
            } else {
              summaries[mode] = { ...emptyModeSummary(), error: apiErr.message };
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
      await refreshQuota();
    }
    setRunning(false);
    setProgress("");
  }

  function stop() {
    abortRef.current = true;
    setProgress("Stopping after current request…");
  }

  async function handleInterestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!interestEmail.trim()) return;
    setInterestStatus("submitting");
    const result = await submitBenchmarkInterest(
      interestEmail.trim(),
      interestName.trim(),
      interestNote.trim(),
    );
    if (result.ok) {
      setInterestStatus("success");
      setInterestMsg(result.message ?? "Thanks!");
    } else {
      setInterestStatus("error");
      setInterestMsg(result.error ?? "Submission failed.");
    }
  }

  const canRun = !running && (quota === null || (quota.remaining_runs > 0 && cooldownSec === 0));
  const canRunAdvanced = canRun && !!advancedKey.trim() && (!usePersonalDocs || !!sessionId);

  // ── live aggregates ────────────────────────────────────────────────────────
  const allLatencies: Record<ApiMode, number[]> = { flat: [], hierarchical: [], llm: [], rag: [] };
  const allConfidences: Record<ApiMode, number[]> = { flat: [], hierarchical: [], llm: [], rag: [] };
  const winCounts: Record<string, number> = { flat: 0, hierarchical: 0, llm: 0, rag: 0, tie: 0 };
  for (const r of results) {
    for (const mode of MODES) {
      if (!r[mode].error && r[mode].latencyMs > 0) allLatencies[mode].push(r[mode].latencyMs);
      if (r[mode].confidence !== null) allConfidences[mode].push(r[mode].confidence!);
    }
    if (r.winner !== "failed" && r.winner !== "skipped")
      winCounts[r.winner]++;
  }

  const hasResults = results.length > 0;
  const liveRows = hasResults ? computeLiveRows(results) : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Mode explainer — collapsible */}
      <ModeIntro />

      {/* Quota display */}
      {quota && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          {quota.remaining_runs > 0 ? (
            <p className="text-text-muted">
              <span className="font-medium text-text">{quota.remaining_runs}</span> of{" "}
              {quota.daily_limit} runs left today
              {cooldownSec > 0 && (
                <>
                  {" · "}next run in{" "}
                  <span className="font-medium text-text">{fmtCooldown(cooldownSec)}</span>
                </>
              )}
            </p>
          ) : (
            <p className="text-accent-text">
              Daily limit reached ({quota.daily_limit}/{quota.daily_limit} runs). Resets at midnight UTC.
            </p>
          )}
        </div>
      )}

      {/* Standard run controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!running ? (
          <button
            type="button"
            onClick={() => void runBenchmark(1, null)}
            disabled={!canRun}
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
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
        {hasResults && (
          <>
            <button
              type="button"
              onClick={() => downloadCsv(results)}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => downloadJson(results, history)}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2"
            >
              Download JSON
            </button>
          </>
        )}
        {progress && <p className="text-sm text-text-muted">{progress}</p>}
      </div>

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

      {/* Advanced: personal-docs (requires key) */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        <h3 className="text-base font-semibold text-text">Advanced: Benchmark on your own docs</h3>
        <p className="text-xs text-text-muted">
          Upload your own PDFs or TXTs and benchmark retrieval against them with up to 10 iterations.
          Requires an access key — request one below if you don&apos;t have one.
        </p>
        <div className="flex flex-col gap-2">
          <label htmlFor="adv-key" className="text-sm font-medium text-text">Access key</label>
          <input
            id="adv-key"
            type="password"
            value={advancedKey}
            onChange={(e) => setAdvancedKey(e.target.value)}
            placeholder="Paste your access key"
            className="w-full max-w-sm rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-focus"
            disabled={running}
            autoComplete="off"
          />
        </div>

        {advancedKey.trim() && (
          <>
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
                      setUploadedFiles(Array.from(e.target.files ?? []));
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
                {uploadStatus && <p className="text-xs text-text-muted">{uploadStatus}</p>}
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
                      onChange={(e) =>
                        setIterations(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))
                      }
                      className="w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
                      disabled={running}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  void runBenchmark(usePersonalDocs ? iterations : 1, usePersonalDocs ? sessionId : null)
                }
                disabled={!canRunAdvanced}
                className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {usePersonalDocs ? `Run on Personal Docs (×${iterations})` : "Run Advanced Benchmark"}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Request access form */}
      <section className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-surface p-5">
        <h3 className="text-base font-semibold text-text">Request access to advanced benchmark</h3>
        <p className="text-xs text-text-muted">
          Leave your email and we&apos;ll send you an access key to run benchmarks on your own documents.
          Your email is used only to send the key — we don&apos;t share it or use it for anything else.
          See our{" "}
          <Link href="/privacy" className="underline hover:text-accent-text">
            Privacy Policy
          </Link>.
        </p>
        {interestStatus === "success" ? (
          <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-text">{interestMsg}</p>
        ) : (
          <form onSubmit={(e) => void handleInterestSubmit(e)} className="flex flex-col gap-3">
            <input
              type="email"
              required
              value={interestEmail}
              onChange={(e) => setInterestEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full max-w-sm rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-focus"
            />
            <input
              type="text"
              value={interestName}
              onChange={(e) => setInterestName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full max-w-sm rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-focus"
            />
            <textarea
              value={interestNote}
              onChange={(e) => setInterestNote(e.target.value)}
              placeholder="What will you benchmark? (optional)"
              rows={2}
              className="w-full max-w-sm rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-focus"
            />
            {interestStatus === "error" && <p className="text-xs text-accent-text">{interestMsg}</p>}
            <button
              type="submit"
              disabled={interestStatus === "submitting"}
              className="inline-flex min-h-10 w-fit items-center rounded-lg bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {interestStatus === "submitting" ? "Submitting…" : "Request access"}
            </button>
          </form>
        )}
      </section>

      {/* Per-query results */}
      {hasResults && (
        <>
          {/* Narrative connector */}
          <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted">
            <span className="font-semibold text-text">Step 1 of 3 — Raw results.</span>
            {" "}Each card shows how that query performed across all four modes.
            Scroll down for the aggregate comparison and org-scale impact.
          </div>

          {/* Aggregate stats */}
          <section
            aria-labelledby="agg-heading"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
          >
            <h3 id="agg-heading" className="mb-1 text-lg font-bold text-text">
              Step 2 — Aggregate ({results.length} queries)
            </h3>
            <p className="mb-4 text-xs text-text-muted">
              Winner = highest BM25 quality proxy score; within {(WINNER_QUALITY_EPSILON * 100).toFixed(0)}% quality →
              latency breaks the tie; within {(WINNER_QUALITY_EPSILON * 100).toFixed(0)}% quality AND{" "}
              {WINNER_LATENCY_TIE_MS}ms → Tie. LLM-only has no retrieval quality score so it rarely wins.
            </p>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm sm:grid-cols-4">
              {MODES.map((mode) => (
                <div key={mode} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {MODE_LABELS[mode]}
                  </span>
                  <span className="text-text">avg {formatLatency(avg(allLatencies[mode]) ?? 0)}</span>
                  {allConfidences[mode].length > 0 && (
                    <span className="flex items-center gap-1 text-text">
                      avg conf {pct(avg(allConfidences[mode]))}
                      <InfoTooltip tip="avg_confidence × 100. Retrieval model's score of how relevant the top chunks were. LLM-only has none." />
                    </span>
                  )}
                  <span className="font-semibold text-accent-text">{winCounts[mode] ?? 0} wins</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-muted">Ties: {winCounts.tie}</p>
          </section>

          {/* Per-query cards */}
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
                    const isWinner = r.winner === mode;
                    return (
                      <div
                        key={mode}
                        className={`flex flex-col gap-1 rounded-md border p-3 ${
                          isWinner
                            ? "border-accent bg-surface-2"
                            : "border-border bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-text-muted">
                            {MODE_LABELS[mode]}
                          </span>
                          {isWinner && (
                            <span className="rounded-full bg-accent px-1.5 py-0 text-[10px] font-bold text-white">
                              ✓
                            </span>
                          )}
                        </div>
                        {s.error ? (
                          <span className="text-xs text-accent-text">{s.error}</span>
                        ) : (
                          <>
                            <span className="font-mono text-xs text-text">
                              {formatLatency(s.latencyMs)}
                            </span>
                            {s.qualityProxy !== null && (
                              <span
                                className={`flex items-center gap-1 font-mono text-xs ${isWinner ? "font-semibold text-text" : "text-text"}`}
                              >
                                quality {pct(s.qualityProxy)}
                                {isWinner && (
                                  <span className="text-accent-text" title="Winner by quality proxy">↑</span>
                                )}
                              </span>
                            )}
                            {s.confidence !== null && (
                              <span className="font-mono text-xs text-text">
                                conf {pct(s.confidence)}
                              </span>
                            )}
                            {s.costUsd > 0 && (
                              <span className="font-mono text-xs text-text">
                                {formatCost(s.costUsd)}
                              </span>
                            )}
                            {s.tokens > 0 && (
                              <span className="font-mono text-xs text-text-muted">
                                {s.tokens} tok
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

          {/* Mode Comparison — live */}
          <section aria-labelledby="comparison-heading" className="flex flex-col gap-4">
            <h2 id="comparison-heading" className="text-2xl font-bold tracking-tight text-text">
              Step 3 — Mode Comparison
            </h2>
            <p className="max-w-prose text-sm text-text-muted">
              Aggregated across your {results.length} {results.length === 1 ? "query" : "queries"}.
              &ldquo;Accuracy %&rdquo; = avg_confidence × 100 from the retrieval model; LLM-only has no retrieval quality metric.
              Use this to decide whether the accuracy lift from RAG justifies its cost for your use case.
            </p>
            <ComparisonTable rows={liveRows ?? undefined} />
          </section>

          {/* Impact Analytics — live (v2 sourced panel behind flag; OFF = unchanged) */}
          {flags.impactV2 ? (
            <ImpactPanel rows={liveRows ?? undefined} queryCount={results.length} />
          ) : (
            <ImpactAnalytics rows={liveRows ?? undefined} queryCount={results.length} />
          )}
        </>
      )}

      {/* Mode Comparison + Impact Analytics — sample (no run yet) */}
      {!hasResults && (
        <>
          <section aria-labelledby="comparison-heading-sample" className="flex flex-col gap-4">
            <h2 id="comparison-heading-sample" className="text-2xl font-bold tracking-tight text-text">
              Mode Comparison <span className="ml-2 text-sm font-normal text-text-muted">(illustrative — run benchmark for live data)</span>
            </h2>
            <p className="max-w-prose text-sm text-text-muted">
              Numbers below are representative of the demo corpus runs. Hit &ldquo;Run Benchmark&rdquo; above to replace these with your own live results.
            </p>
            <ComparisonTable />
          </section>
          {flags.impactV2 ? <ImpactPanel /> : <ImpactAnalytics />}
        </>
      )}
    </div>
  );
}
