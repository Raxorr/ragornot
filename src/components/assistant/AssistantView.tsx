"use client";

import { useRef, useState, type FormEvent } from "react";
import type { RetrievalMode } from "@/lib/config";
import { corpusServices, corpusSize, runRetrieval, type RetrievalResult } from "@/lib/search";
import ModeSelector from "./ModeSelector";
import ExampleChips from "./ExampleChips";
import ResultsPanel from "./ResultsPanel";

function listWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// Caps how long the UI "waits" for the two simulated modes — their computed
// latency can run past a second, but the point is to feel roughly honest,
// not to actually make someone wait.
const MAX_SIMULATED_DELAY_MS = 1200;

export default function AssistantView() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<RetrievalMode>("flat");
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runSearch(nextQuery: string, nextMode: RetrievalMode) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!nextQuery.trim()) {
      setResult(null);
      setPending(false);
      return;
    }

    const computed = runRetrieval(nextQuery, nextMode);

    if (computed.simulated) {
      setResult(computed);
      setPending(true);
      timeoutRef.current = setTimeout(() => {
        setPending(false);
      }, Math.min(computed.latencyMs, MAX_SIMULATED_DELAY_MS));
    } else {
      setPending(false);
      setResult(computed);
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
        <label htmlFor="assistant-query" className="text-sm font-semibold text-text">
          Ask a question
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="assistant-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask about Lambda, S3, IAM, CloudFront…"
            className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-4 text-text placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          />
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-accent px-5 font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Search
          </button>
        </div>
        <ExampleChips onPick={handlePickExample} />
      </form>

      <ModeSelector mode={mode} onChange={handleModeChange} />

      <div>
        <p className="mb-3 text-xs text-text-muted">
          Demo index: {corpusSize} curated snippets across {listWithAnd(corpusServices)} docs.
        </p>
        <div aria-live="polite" aria-busy={pending}>
          <ResultsPanel result={result} pending={pending} />
        </div>
      </div>
    </div>
  );
}
