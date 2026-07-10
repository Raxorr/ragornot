"use client";

import { useState } from "react";
import Link from "next/link";
import { useSessionImpact } from "@/lib/session-impact";
import { flags } from "@/lib/flags";
import { DEFAULT_GRID, formatEnergyWh, formatCo2Grams, formatWaterMl } from "@/lib/impact-data";

/**
 * Small floating self-consumption meter. Shows the ESTIMATED energy/water/CO₂
 * this session's real Benchmark/Explore runs have consumed. Appears only once
 * there's at least one run, and only when the feature flag is on. Collapsible
 * and honest — resets on refresh, links to the methodology.
 */
export default function SessionMeter() {
  const impact = useSessionImpact();
  const [collapsed, setCollapsed] = useState(false);

  // Nothing to show until a real run has happened.
  if (!flags.sessionMeter || !impact || impact.runs === 0) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Show session impact meter"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-text shadow-lg transition-colors hover:border-accent"
      >
        <span aria-hidden="true">⚡</span>
        {formatEnergyWh(impact.energyWh)} this session
      </button>
    );
  }

  return (
    <section
      aria-label="Session self-consumption meter"
      className="fixed bottom-4 right-4 z-40 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-text">
            This session (estimated)
          </span>
          <span className="text-[11px] text-text-muted">
            {impact.runs} {impact.runs === 1 ? "run" : "runs"} · {impact.llmRuns} LLM/RAG
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse session impact meter"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <span aria-hidden="true">–</span>
        </button>
      </div>

      <dl aria-live="polite" className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-border bg-surface-2 px-1 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-text-muted">Energy</dt>
          <dd className="mt-0.5 font-mono text-xs font-semibold text-text">{formatEnergyWh(impact.energyWh)}</dd>
        </div>
        <div className="rounded-md border border-border bg-surface-2 px-1 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-text-muted">Water</dt>
          <dd className="mt-0.5 font-mono text-xs font-semibold text-text">{formatWaterMl(impact.waterFullMl)}</dd>
        </div>
        <div className="rounded-md border border-border bg-surface-2 px-1 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-text-muted">CO₂</dt>
          <dd className="mt-0.5 font-mono text-xs font-semibold text-text">{formatCo2Grams(impact.co2g)}</dd>
        </div>
      </dl>

      <p className="mt-2 text-[10px] leading-snug text-text-muted">
        Order-of-magnitude estimate from real run tokens · water full-scope · {DEFAULT_GRID.gPerKwh} gCO₂/kWh ·
        resets on refresh.{" "}
        <Link href="/methodology" className="underline hover:text-accent-text">
          Method
        </Link>
      </p>
    </section>
  );
}
