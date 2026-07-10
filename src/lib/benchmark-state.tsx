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
import {
  callApi,
  checkBenchmarkQuota,
  type ApiMode,
  type ApiError,
  type BenchmarkQuota,
} from "./api";
import { flags } from "./flags";
import { useSessionImpact } from "./session-impact";
import {
  BENCHMARK_QUERIES,
  MODES,
  MODE_LABELS,
  REQUEST_DELAY_MS,
  buildSummary,
  decideWinner,
  emptyModeSummary,
  newRunId,
  sleep,
  type ModeSummary,
  type QueryResult,
  type RunRecord,
} from "./benchmark-engine";

// Owns ALL ephemeral Benchmark state so it survives soft (tab-to-tab) navigation
// and is cleared only on a hard refresh. Mounted once in the root layout, so the
// run loop below keeps running even if the Benchmark page unmounts mid-run — its
// result lands here and is shown when the user returns. Rate limits stay
// server-authoritative: the cooldown is derived from an absolute `nextEligibleAt`
// timestamp (not a per-mount countdown), so it's continuous across navigation.

export interface RunBenchmarkParams {
  iterCount: number;
  sessionId: string | null;
  benchmarkKey: string;
}

interface BenchmarkStateValue {
  running: boolean;
  progress: string;
  results: QueryResult[];
  history: RunRecord[];
  error: string | null;
  quota: BenchmarkQuota | null;
  /** Seconds until the next run is allowed, derived from an absolute timestamp. */
  cooldownSec: number;
  /** True once a quota has been fetched at least once this session. */
  quotaLoaded: boolean;
  runBenchmark: (params: RunBenchmarkParams) => void;
  stop: () => void;
  /** Re-sync remaining runs / cooldown from the server WITHOUT touching results. */
  refreshQuota: () => Promise<void>;
}

const BenchmarkStateContext = createContext<BenchmarkStateValue | null>(null);

export function BenchmarkStateProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<BenchmarkQuota | null>(null);
  const [quotaLoaded, setQuotaLoaded] = useState(false);
  const [nextEligibleAt, setNextEligibleAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const abortRef = useRef(false);
  const runningRef = useRef(false);
  const sessionImpact = useSessionImpact();

  // Tick the clock once per second while a cooldown is active. Date.now() is read
  // only inside the timer callback (never during render), and the interval stops
  // itself once the deadline passes. Lives in the provider (mounted once), so
  // remounting the Benchmark page never resets the countdown.
  useEffect(() => {
    if (nextEligibleAt === null || nextEligibleAt <= Date.now()) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      if (t >= nextEligibleAt) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [nextEligibleAt]);

  // Derived from two absolute timestamps — pure during render.
  const cooldownSec =
    nextEligibleAt && nextEligibleAt > nowMs ? Math.ceil((nextEligibleAt - nowMs) / 1000) : 0;

  const applyQuota = useCallback((q: BenchmarkQuota) => {
    setQuota(q);
    setQuotaLoaded(true);
    const now = Date.now();
    setNowMs(now);
    setNextEligibleAt(now + Math.max(0, q.seconds_until_next) * 1000);
  }, []);

  const refreshQuota = useCallback(async () => {
    const result = await checkBenchmarkQuota();
    if (result.ok && result.quota) applyQuota(result.quota);
  }, [applyQuota]);

  const stop = useCallback(() => {
    abortRef.current = true;
    setProgress("Stopping after current request…");
  }, []);

  const runBenchmark = useCallback(
    ({ iterCount, sessionId: sid, benchmarkKey }: RunBenchmarkParams) => {
      // Guard against double-submit: a remounting page or a second click can't
      // start a concurrent run.
      if (runningRef.current) return;
      runningRef.current = true;
      abortRef.current = false;
      setRunning(true);
      setError(null);
      setResults([]);

      // Fire-and-forget: the loop is owned by the provider, so navigating away
      // does NOT abort it — the finished result lands in context.
      void (async () => {
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
              setProgress(`Query ${qi + 1}/${BENCHMARK_QUERIES.length} — ${MODE_LABELS[mode]}${iterLabel}`);

              if (reqIdx > 0) await sleep(REQUEST_DELAY_MS);
              reqIdx++;

              const options = sid
                ? {
                    benchmark: true,
                    benchmarkKey,
                    benchmarkMode: iterCount > 1 ? ("x10" as const) : ("normal" as const),
                    runId,
                    sessionId: sid,
                  }
                : { benchmark: true, benchmarkMode: "normal" as const, runId };

              try {
                const { data, latencyMs } = await callApi(q, mode, options);
                summaries[mode] = buildSummary(data, latencyMs);
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
          applyQuota(lastQuotaInfo);
        } else {
          await refreshQuota();
        }
        setRunning(false);
        setProgress("");
        runningRef.current = false;
      })();
    },
    [applyQuota, refreshQuota, sessionImpact],
  );

  const value = useMemo<BenchmarkStateValue>(
    () => ({
      running,
      progress,
      results,
      history,
      error,
      quota,
      cooldownSec,
      quotaLoaded,
      runBenchmark,
      stop,
      refreshQuota,
    }),
    [running, progress, results, history, error, quota, cooldownSec, quotaLoaded, runBenchmark, stop, refreshQuota],
  );

  return <BenchmarkStateContext.Provider value={value}>{children}</BenchmarkStateContext.Provider>;
}

export function useBenchmarkState(): BenchmarkStateValue {
  const ctx = useContext(BenchmarkStateContext);
  if (!ctx) throw new Error("useBenchmarkState must be used within BenchmarkStateProvider");
  return ctx;
}
