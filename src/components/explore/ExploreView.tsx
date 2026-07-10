"use client";

import { type FormEvent } from "react";
import type { RetrievalMode } from "@/lib/config";
import ModeSelector from "@/components/assistant/ModeSelector";
import ExampleChips from "@/components/assistant/ExampleChips";
import ApiResultsPanel from "./ApiResultsPanel";
import { useExploreState, MODE_MAP } from "@/lib/explore-state";

export default function ExploreView() {
  // Query, mode, results, and the in-flight request all live in the root-layout
  // provider — this component is a thin consumer, so switching tabs and coming
  // back shows exactly what was here (and a mid-flight search still lands).
  const { query, mode, result, latencyMs, pending, error, setQuery, setMode, runSearch } =
    useExploreState();

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
