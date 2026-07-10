"use client";

import { useState, type FormEvent } from "react";
import type { RetrievalMode } from "@/lib/config";
import { callApi, type ApiResponse, type ApiError } from "@/lib/api";
import ModeSelector from "@/components/assistant/ModeSelector";
import ExampleChips from "@/components/assistant/ExampleChips";
import { useExploreStats } from "./ExploreStatsContext";
import ApiResultsPanel from "./ApiResultsPanel";
import { useSessionImpact } from "@/lib/session-impact";
import { flags } from "@/lib/flags";

const MODE_MAP: Record<RetrievalMode, "flat" | "hierarchical" | "llm" | "rag"> = {
  flat: "flat",
  hierarchical: "hierarchical",
  "llm-only": "llm",
  rag: "rag",
};

export default function ExploreView() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<RetrievalMode>("flat");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stats = useExploreStats();
  const sessionImpact = useSessionImpact();

  async function runSearch(nextQuery: string, nextMode: RetrievalMode) {
    if (!nextQuery.trim()) {
      setResult(null);
      setError(null);
      return;
    }

    setPending(true);
    setError(null);

    try {
      const apiMode = MODE_MAP[nextMode];
      const { data, latencyMs: ms } = await callApi(nextQuery, apiMode);
      setResult(data);
      setLatencyMs(ms);
      // Feed the hero strip: all runs update avg latency; llm/rag bump LLM calls.
      stats?.recordRun(apiMode, ms);
      // Feed the session self-consumption meter with this run's real tokens.
      if (flags.sessionMeter) {
        const tokens = (data.llm_stats?.input_tokens ?? 0) + (data.llm_stats?.output_tokens ?? 0);
        sessionImpact?.record(apiMode, tokens, data.llm_stats?.cost_usd ?? 0, ms);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      // Use the backend's message directly — it explains the quota and suggests alternatives.
      setError(apiErr.message || "Network error. Check your connection and try again.");
      setResult(null);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    runSearch(query, mode);
  }

  function handlePickExample(example: string) {
    setQuery(example);
    runSearch(example, mode);
  }

  function handleModeChange(nextMode: RetrievalMode) {
    setMode(nextMode);
    if (query.trim()) runSearch(query, nextMode);
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="explore-query" className="text-sm font-semibold text-text">
          Ask a question
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="explore-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask about Lambda, S3, IAM, CloudFront…"
            disabled={pending}
            className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-4 text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-lg bg-accent px-5 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Searching…" : "Search"}
          </button>
        </div>
        <ExampleChips onPick={handlePickExample} />
      </form>

      <ModeSelector mode={mode} onChange={handleModeChange} />

      {error && (
        <div role="alert" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-accent-text">
          {error}
        </div>
      )}

      <div>
        <p className="mb-3 text-xs text-text-muted">
          Live index: 116 curated AWS documentation pages, 4 retrieval modes, real Bedrock calls for LLM and RAG.
        </p>
        <div aria-live="polite" aria-busy={pending}>
          <ApiResultsPanel result={result} latencyMs={latencyMs} pending={pending} mode={MODE_MAP[mode]} />
        </div>
      </div>
    </div>
  );
}
