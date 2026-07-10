"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RetrievalMode } from "./config";
import { callApi, type ApiResponse, type ApiError, type ApiMode } from "./api";
import { flags } from "./flags";
import { useSessionImpact } from "./session-impact";
import { SESSION_KEYS, loadSession, saveSession } from "./session-persist";
import { useExploreStats } from "@/components/explore/ExploreStatsContext";

interface PersistedExplore {
  query: string;
  mode: RetrievalMode;
  result: ApiResponse;
  latencyMs: number;
}

export const MODE_MAP: Record<RetrievalMode, ApiMode> = {
  flat: "flat",
  hierarchical: "hierarchical",
  "llm-only": "llm",
  rag: "rag",
};

// Owns the Explore query/mode/results so they survive soft navigation and reset
// only on hard refresh. The search runs here (not in the page), so navigating
// away mid-request doesn't lose the result — it lands in this context.

interface ExploreStateValue {
  query: string;
  mode: RetrievalMode;
  result: ApiResponse | null;
  latencyMs: number;
  pending: boolean;
  error: string | null;
  setQuery: (q: string) => void;
  setMode: (m: RetrievalMode) => void;
  runSearch: (query: string, mode: RetrievalMode) => void;
}

const ExploreStateContext = createContext<ExploreStateValue | null>(null);

export function ExploreStateProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<RetrievalMode>("flat");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const stats = useExploreStats();
  const sessionImpact = useSessionImpact();

  // Rehydrate the last Explore result from sessionStorage on mount (client only,
  // after hydration) so an accidental refresh restores query/mode/results.
  useEffect(() => {
    const saved = loadSession<PersistedExplore>(SESSION_KEYS.explore);
    if (saved && saved.result) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setQuery(saved.query ?? "");
      setMode(saved.mode ?? "flat");
      setResult(saved.result);
      setLatencyMs(saved.latencyMs ?? 0);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  const runSearch = useCallback(
    (nextQuery: string, nextMode: RetrievalMode) => {
      if (!nextQuery.trim()) {
        setResult(null);
        setError(null);
        return;
      }
      // Guard double-submit; a remounting page never re-triggers a run.
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      setError(null);

      const apiMode = MODE_MAP[nextMode];
      // Owned by the provider — continues to completion even if the page unmounts.
      void (async () => {
        try {
          const { data, latencyMs: ms } = await callApi(nextQuery, apiMode);
          setResult(data);
          setLatencyMs(ms);
          // Persist the last successful search so a refresh restores it. A new
          // search overwrites; errors don't persist.
          saveSession(SESSION_KEYS.explore, { query: nextQuery, mode: nextMode, result: data, latencyMs: ms });
          stats?.recordRun(apiMode, ms);
          if (flags.sessionMeter) {
            const tokens = (data.llm_stats?.input_tokens ?? 0) + (data.llm_stats?.output_tokens ?? 0);
            sessionImpact?.record(apiMode, tokens, data.llm_stats?.cost_usd ?? 0, ms);
          }
        } catch (err) {
          const apiErr = err as ApiError;
          setError(apiErr.message || "Network error. Check your connection and try again.");
          setResult(null);
        } finally {
          pendingRef.current = false;
          setPending(false);
        }
      })();
    },
    [stats, sessionImpact],
  );

  const value = useMemo<ExploreStateValue>(
    () => ({ query, mode, result, latencyMs, pending, error, setQuery, setMode, runSearch }),
    [query, mode, result, latencyMs, pending, error, runSearch],
  );

  return <ExploreStateContext.Provider value={value}>{children}</ExploreStateContext.Provider>;
}

export function useExploreState(): ExploreStateValue {
  const ctx = useContext(ExploreStateContext);
  if (!ctx) throw new Error("useExploreState must be used within ExploreStateProvider");
  return ctx;
}
