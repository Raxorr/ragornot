"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ApiMode } from "./api";
import {
  ENERGY,
  RETRIEVAL_ONLY_ENERGY_WH,
  DEFAULT_GRID,
  energyWhFromTokens,
  co2GramsFromEnergy,
  waterMlFromEnergy,
} from "./impact-data";

// Tier 1 self-consumption meter: accumulate ESTIMATED energy/water/CO₂ from the
// real per-run token data of this session's Benchmark/Explore runs. State lives
// in React only — no backend, no localStorage. Resetting on refresh is expected
// and keeps the number honestly session-scoped.
//
// TODO(tier-2, additive & non-breaking): a true cumulative cross-user meter
// would read a running total the Lambda already accumulates in S3 (it tracks a
// daily Bedrock cost counter) and expose it via a read-only GET endpoint, e.g.
// GET {API_BASE}/api/impact -> { total_tokens, total_energy_wh, since }. The
// widget would prefer that global number when present and fall back to this
// session estimate otherwise. It must NOT modify the live Lambda in this branch
// — see ARCHITECTURE.md "Self-consumption meter (Tier 2 — design only)".

export interface SessionTotals {
  runs: number;
  llmRuns: number;
  tokens: number;
  energyWh: number;
  waterFullMl: number;
  waterScope1Ml: number;
  co2g: number;
}

interface SessionImpactValue extends SessionTotals {
  /** Record one real run. Derives energy from tokens for LLM/RAG; retrieval-only for lexical modes. */
  record: (mode: ApiMode, tokens: number, costUsd: number, latencyMs: number) => void;
  reset: () => void;
}

const EMPTY: SessionTotals = {
  runs: 0,
  llmRuns: 0,
  tokens: 0,
  energyWh: 0,
  waterFullMl: 0,
  waterScope1Ml: 0,
  co2g: 0,
};

const SessionImpactContext = createContext<SessionImpactValue | null>(null);

/** Marginal energy (Wh) for one run — token-derived for LLM/RAG, tiny fixed cost for lexical. */
function runEnergyWh(mode: ApiMode, tokens: number): number {
  if (mode === "flat") return RETRIEVAL_ONLY_ENERGY_WH.flat;
  if (mode === "hierarchical") return RETRIEVAL_ONLY_ENERGY_WH.hierarchical;
  // llm / rag: from this run's own tokens (anchored to the Epoch short-query figure).
  return tokens > 0 ? energyWhFromTokens(tokens) : ENERGY.chatShort.value;
}

export function SessionImpactProvider({ children }: { children: ReactNode }) {
  const [totals, setTotals] = useState<SessionTotals>(EMPTY);

  const record = useCallback((mode: ApiMode, tokens: number) => {
    const energyWh = runEnergyWh(mode, tokens);
    const isLlm = mode === "llm" || mode === "rag";
    setTotals((t) => ({
      runs: t.runs + 1,
      llmRuns: t.llmRuns + (isLlm ? 1 : 0),
      tokens: t.tokens + (tokens > 0 ? tokens : 0),
      energyWh: t.energyWh + energyWh,
      waterFullMl: t.waterFullMl + waterMlFromEnergy(energyWh, "fullScope"),
      waterScope1Ml: t.waterScope1Ml + waterMlFromEnergy(energyWh, "scope1"),
      co2g: t.co2g + co2GramsFromEnergy(energyWh, DEFAULT_GRID.gPerKwh),
    }));
  }, []);

  const reset = useCallback(() => setTotals(EMPTY), []);

  const value = useMemo<SessionImpactValue>(
    () => ({ ...totals, record, reset }),
    [totals, record, reset],
  );

  return <SessionImpactContext.Provider value={value}>{children}</SessionImpactContext.Provider>;
}

/** Session totals + recorder, or null when rendered outside the provider. */
export function useSessionImpact(): SessionImpactValue | null {
  return useContext(SessionImpactContext);
}
