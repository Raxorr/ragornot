"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ApiMode } from "@/lib/api";

// Session-scoped Explore stats that power the hero stat strip. State lives in
// React only (no backend call, no localStorage) — resetting on refresh is
// expected and keeps the numbers honestly session-scoped.
interface ExploreStatsValue {
  runCount: number;
  llmCalls: number;
  avgLatencyMs: number | null;
  /** Record one successful query. LLM/RAG bump the LLM-call counter; all runs feed avg latency. */
  recordRun: (mode: ApiMode, latencyMs: number) => void;
}

const ExploreStatsContext = createContext<ExploreStatsValue | null>(null);

export function ExploreStatsProvider({ children }: { children: ReactNode }) {
  const [runCount, setRunCount] = useState(0);
  const [llmCalls, setLlmCalls] = useState(0);
  const [totalLatencyMs, setTotalLatencyMs] = useState(0);

  const recordRun = useCallback((mode: ApiMode, latencyMs: number) => {
    setRunCount((n) => n + 1);
    setTotalLatencyMs((t) => t + latencyMs);
    if (mode === "llm" || mode === "rag") setLlmCalls((n) => n + 1);
  }, []);

  const value = useMemo<ExploreStatsValue>(
    () => ({
      runCount,
      llmCalls,
      avgLatencyMs: runCount > 0 ? Math.round(totalLatencyMs / runCount) : null,
      recordRun,
    }),
    [runCount, llmCalls, totalLatencyMs, recordRun],
  );

  return <ExploreStatsContext.Provider value={value}>{children}</ExploreStatsContext.Provider>;
}

/** Returns the session stats, or null when rendered outside the provider. */
export function useExploreStats(): ExploreStatsValue | null {
  return useContext(ExploreStatsContext);
}
