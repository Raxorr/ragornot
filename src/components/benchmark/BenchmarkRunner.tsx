"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { uploadDocs, submitBenchmarkInterest, type ApiMode } from "@/lib/api";
import { formatCost, formatLatency } from "@/lib/format";
import { benchmarkRows, type BenchmarkRow } from "@/lib/benchmark-data";
import type { RetrievalMode } from "@/lib/config";
import ComparisonTable from "./ComparisonTable";
import ImpactPanel from "@/components/impact/ImpactPanel";
import { co2GramsFromEnergy, DEFAULT_GRID, formatCo2Grams, energyWhFromTokens, RETRIEVAL_ONLY_ENERGY_WH } from "@/lib/impact-data";
import { absoluteUrl } from "@/lib/site-url";
import ShareCard from "@/components/share/ShareCard";
import type { ShareCardData } from "@/lib/share-card";
import ModeIntro from "./ModeIntro";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { useBenchmarkState } from "@/lib/benchmark-state";
import {
  BENCHMARK_QUERIES,
  MODES,
  MODE_LABELS,
  WINNER_QUALITY_EPSILON,
  WINNER_LATENCY_TIE_MS,
  type QueryResult,
  type RunRecord,
} from "@/lib/benchmark-engine";

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

/**
 * Compute per-mode aggregate rows from live benchmark results.
 * LLM-only rarely wins because it has no qualityProxy (BM25 score) — see winner logic.
 * Energy for LLM/RAG is derived from the run's TOKEN count via energyWhFromTokens()
 * (anchored to Epoch AI's short-query figure) — not from dollar cost.
 * Flat/Hierarchical use the static near-zero energy figures (in-Lambda BM25, negligible GPU).
 */
function computeLiveRows(results: QueryResult[]): BenchmarkRow[] {
  return MODES.map((mode) => {
    const valid = results.filter((r) => !r[mode].error && r[mode].latencyMs > 0);
    const avgLatency = avg(valid.map((r) => r[mode].latencyMs)) ?? 0;
    const avgCost = avg(valid.map((r) => r[mode].costUsd)) ?? 0;
    const avgTokens = avg(valid.map((r) => r[mode].tokens)) ?? 0;
    const confs = valid.map((r) => r[mode].confidence).filter((c): c is number => c !== null);
    const avgConf = confs.length ? avg(confs) : null;
    const energyPerQueryWh =
      mode === "llm" || mode === "rag"
        ? energyWhFromTokens(avgTokens)
        : mode === "hierarchical"
          ? RETRIEVAL_ONLY_ENERGY_WH.hierarchical
          : RETRIEVAL_ONLY_ENERGY_WH.flat;
    const staticRow = benchmarkRows.find(
      (r) => r.mode === (mode === "llm" ? "llm-only" : mode),
    );
    return {
      mode: (mode === "llm" ? "llm-only" : mode) as RetrievalMode,
      label: MODE_LABELS[mode],
      relevancePct:
        avgConf !== null ? Math.round(avgConf * 100) : (staticRow?.relevancePct ?? 0),
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
  // All run state (results, history, quota, cooldown) and the in-flight run loop
  // live in the root-layout BenchmarkStateProvider, so they survive tab switches
  // and a mid-run navigation still lands its result. This component is a thin
  // consumer plus its own local form/upload state.
  const {
    running,
    progress,
    results,
    history,
    error,
    quota,
    cooldownSec,
    quotaLoaded,
    lastRunRateLimited,
    runBenchmark,
    stop,
    refreshQuota,
  } = useBenchmarkState();

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

  // Re-sync remaining runs / cooldown from the server on each visit to this page,
  // WITHOUT wiping displayed results (refreshQuota only touches quota state, and
  // the cooldown derives from an absolute timestamp so it doesn't reset to full).
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

  // Gate on BOTH the daily quota AND the per-run interval cooldown, and stay
  // disabled until the quota has actually loaded (no optimistic "quota === null"
  // window that let a doomed click fire before state was known).
  const canRun =
    !running && quotaLoaded && quota !== null && quota.remaining_runs > 0 && cooldownSec === 0;
  const canRunAdvanced = canRun && !!advancedKey.trim() && (!usePersonalDocs || !!sessionId);

  // Make the disabled reason obvious on the button itself.
  const runButtonLabel = !quotaLoaded
    ? "Checking limits…"
    : quota && quota.remaining_runs === 0
      ? "Daily limit reached"
      : cooldownSec > 0
        ? `Next run in ${fmtCooldown(cooldownSec)}`
        : "Run Benchmark";

  // A query "succeeded" if at least one mode returned a real (non-error) result.
  // Rate-limited/failed queries are excluded so a rejected run is never treated
  // as a completed benchmark.
  const successfulResults = results.filter((r) =>
    MODES.some((m) => !r[m].error && r[m].latencyMs > 0),
  );
  const successCount = successfulResults.length;
  const hasLiveResults = successCount > 0;
  const totalAttempted = results.length;
  const isPartial = hasLiveResults && successCount < totalAttempted;

  // ── live aggregates (successful queries only) ───────────────────────────────
  const allLatencies: Record<ApiMode, number[]> = { flat: [], hierarchical: [], llm: [], rag: [] };
  const allConfidences: Record<ApiMode, number[]> = { flat: [], hierarchical: [], llm: [], rag: [] };
  const winCounts: Record<string, number> = { flat: 0, hierarchical: 0, llm: 0, rag: 0, tie: 0 };
  for (const r of successfulResults) {
    for (const mode of MODES) {
      if (!r[mode].error && r[mode].latencyMs > 0) allLatencies[mode].push(r[mode].latencyMs);
      if (r[mode].confidence !== null) allConfidences[mode].push(r[mode].confidence!);
    }
    if (r.winner !== "failed" && r.winner !== "skipped")
      winCounts[r.winner]++;
  }

  const liveRows = hasLiveResults ? computeLiveRows(successfulResults) : null;

  // Shareable result card — built from the winning mode's live numbers.
  const shareCardData: ShareCardData | null = (() => {
    if (!liveRows) return null;
    const modeWins = MODES.map((m) => ({ m, n: winCounts[m] ?? 0 }));
    const top = modeWins.reduce((a, b) => (b.n > a.n ? b : a));
    if (top.n === 0) return null;
    const isTie = (winCounts.tie ?? 0) >= top.n;
    const winnerRowMode: RetrievalMode = top.m === "llm" ? "llm-only" : top.m;
    const row = liveRows.find((r) => r.mode === winnerRowMode);
    if (!row) return null;
    const co2 = co2GramsFromEnergy(row.energyPerQueryWh, DEFAULT_GRID.gPerKwh);
    return {
      eyebrow: "ragornot benchmark",
      headline: isTie ? "It's a tie" : `${MODE_LABELS[top.m]} wins`,
      stats: [
        { label: "Relevance", value: `${row.relevancePct}%` },
        { label: "Latency", value: formatLatency(row.latencyMs) },
        { label: "Cost/query", value: formatCost(row.costPerQueryUsd) },
        { label: "CO₂/query", value: formatCo2Grams(co2) },
      ],
      note: `${successCount} ${successCount === 1 ? "query" : "queries"} · ${DEFAULT_GRID.gPerKwh} gCO₂/kWh`,
    };
  })();

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

      {/* A run attempt that the server rejected (interval cooldown / cap) is NOT a
          benchmark. Show a friendly cooldown state instead of an empty result. */}
      {lastRunRateLimited && (
        <div role="status" className="rounded-lg border border-accent/50 bg-surface-2 px-4 py-3 text-sm text-text">
          You&apos;re on cooldown
          {quota ? ` — ${quota.remaining_runs} of ${quota.daily_limit} runs left today` : ""}
          {cooldownSec > 0 ? `, next run in ${fmtCooldown(cooldownSec)}` : ""}. That attempt was
          rate-limited by the server, so it doesn&apos;t count as a benchmark. Try again then.
        </div>
      )}

      {/* After a hard refresh, results are cleared but server-side limits persist.
          Make that combination less confusing. */}
      {quotaLoaded && !hasLiveResults && !lastRunRateLimited && cooldownSec > 0 && (
        <p className="text-xs text-text-muted">
          Previous results were cleared on refresh — your run limits are still counted server-side.
        </p>
      )}

      {/* Standard run controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!running ? (
          <button
            type="button"
            onClick={() => runBenchmark({ iterCount: 1, sessionId: null, benchmarkKey: "" })}
            disabled={!canRun}
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-5 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {runButtonLabel}
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
        {hasLiveResults && (
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
                  runBenchmark({
                    iterCount: usePersonalDocs ? iterations : 1,
                    sessionId: usePersonalDocs ? sessionId : null,
                    benchmarkKey: advancedKey.trim(),
                  })
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
      {hasLiveResults && (
        <>
          {/* Narrative connector */}
          <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted">
            <span className="font-semibold text-text">Step 1 of 3 — Raw results.</span>
            {" "}Each card shows how that query performed across all four modes.
            {isPartial && (
              <> {" "}<span className="font-medium text-accent-text">
                {successCount} of {totalAttempted} queries succeeded; the rest were rate-limited and are
                excluded from the aggregates below.
              </span></>
            )}
            {" "}Scroll down for the aggregate comparison and org-scale impact.
          </div>

          {/* Aggregate stats */}
          <section
            aria-labelledby="agg-heading"
            className="rounded-lg border border-border bg-surface p-5 sm:p-6"
          >
            <h3 id="agg-heading" className="mb-1 text-lg font-bold text-text">
              Step 2 — Aggregate ({successCount} {successCount === 1 ? "query" : "queries"}
              {isPartial ? ` of ${totalAttempted}` : ""})
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
              Aggregated across your {successCount} successful {successCount === 1 ? "query" : "queries"}
              {isPartial ? ` (of ${totalAttempted} attempted)` : ""}.
              &ldquo;Relevance %&rdquo; = avg_confidence × 100 from the retrieval model&apos;s lexical match score — not answer correctness.
              LLM-only has no retrieval quality metric. Use this to decide whether the relevance lift from RAG justifies its cost for your use case.
            </p>
            <p className="max-w-prose text-xs text-text-muted">
              <span className="font-medium text-text">Retrieval relevance</span> is the lexical match confidence of
              retrieved chunks — not answer correctness. End-answer evaluation (correctness, faithfulness, citation
              quality) is a planned future metric.
            </p>
            <ComparisonTable rows={liveRows ?? undefined} />
          </section>

          {/* Impact Analytics — sourced, coefficient-linked panel */}
          <ImpactPanel rows={liveRows ?? undefined} queryCount={successCount} />

          {/* Shareable result card — the winning mode's live numbers */}
          {shareCardData && (
            <section
              aria-labelledby="share-heading"
              className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 sm:p-6"
            >
              <h3 id="share-heading" className="text-lg font-bold text-text">Share this result</h3>
              <ShareCard
                data={shareCardData}
                fileName="ragornot-benchmark"
                shareText={`I benchmarked four retrieval modes on ragornot — ${shareCardData.headline}. Try it:`}
                shareUrl={absoluteUrl("/benchmark")}
              />
            </section>
          )}
        </>
      )}

      {/* Mode Comparison + Impact Analytics — representative view (no successful run) */}
      {!hasLiveResults && (
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
          <ImpactPanel />
        </>
      )}
    </div>
  );
}
