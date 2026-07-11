"use client";

import { useState } from "react";
import Link from "next/link";
import { benchmarkRows, type BenchmarkRow } from "@/lib/benchmark-data";
import { formatCost } from "@/lib/format";
import {
  ENERGY,
  WATER,
  GRID_OPTIONS,
  GRID_INTENSITY_SOURCE,
  DEFAULT_GRID,
  RETRIEVAL_ONLY_ENERGY_WH,
  ENERGY_WH_PER_1K_TOKENS,
  ENERGY_UNCERTAINTY,
  ENERGY_ASSUMPTIONS,
  DEFAULT_ENERGY_ASSUMPTION,
  PUE_OPTIONS,
  DEFAULT_PUE_ID,
  BASELINE_PUE,
  PUE_SOURCE,
  co2GramsFromEnergy,
  waterMlFromEnergy,
  formatEnergyWh,
  formatCo2Grams,
  formatWaterMl,
  EQUIVALENTS,
  type Band,
} from "@/lib/impact-data";
import BarChart from "@/components/news/BarChart";
import InfoTooltip from "@/components/ui/InfoTooltip";
import SourceCite from "./SourceCite";
import EnergyContrast from "./EnergyContrast";

const PRESETS = [1_000, 10_000, 100_000];

interface ImpactPanelProps {
  rows?: BenchmarkRow[];
  queryCount?: number;
}

/** Small measured-vs-modeled tag so a reader never mistakes an estimate for a measurement. */
function MetricBadge({ kind }: { kind: "measured" | "modeled" }) {
  const measured = kind === "measured";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={
        measured
          ? { color: "#16a34a", backgroundColor: "rgba(22,163,74,0.15)" }
          : { color: "#d97706", backgroundColor: "rgba(217,119,6,0.15)" }
      }
    >
      {measured ? "measured" : "modeled — estimate"}
    </span>
  );
}

/** Base marginal per-query energy (Wh) for a mode, before PUE / assumption scaling. */
function modeBaseEnergyWh(row: BenchmarkRow, isLive: boolean): number {
  if (row.mode === "flat") return RETRIEVAL_ONLY_ENERGY_WH.flat;
  if (row.mode === "hierarchical") return RETRIEVAL_ONLY_ENERGY_WH.hierarchical;
  // llm-only / rag: live runs carry token-derived energy; illustrative uses the literature figure.
  return isLive && row.energyPerQueryWh > 0 ? row.energyPerQueryWh : ENERGY.chatShort.value;
}

function fmtBand(fmt: (n: number) => string, band: Band): string {
  return `${fmt(band.mid)} (${fmt(band.low)}–${fmt(band.high)})`;
}

export default function ImpactPanel({ rows, queryCount }: ImpactPanelProps) {
  const data = rows ?? benchmarkRows;
  const isLive = Boolean(rows);

  const [gridId, setGridId] = useState(DEFAULT_GRID.id);
  const grid = GRID_OPTIONS.find((g) => g.id === gridId) ?? DEFAULT_GRID;

  const [pueId, setPueId] = useState(DEFAULT_PUE_ID);
  const pue = PUE_OPTIONS.find((p) => p.id === pueId) ?? PUE_OPTIONS[1];
  const pueFactor = pue.value / BASELINE_PUE;

  const [energyAssumptionId, setEnergyAssumptionId] = useState(DEFAULT_ENERGY_ASSUMPTION);
  const assumption = ENERGY_ASSUMPTIONS.find((a) => a.id === energyAssumptionId) ?? ENERGY_ASSUMPTIONS[1];

  const [queriesPerDay, setQueriesPerDay] = useState(10_000);
  const [inputVal, setInputVal] = useState("10000");

  // Per-mode point + uncertainty band. Only LLM/RAG carry the Epoch band; lexical
  // modes make no LLM call, so their tiny figure has no such uncertainty.
  const derived = data.map((row) => {
    const baseMid = modeBaseEnergyWh(row, isLive);
    const isLlm = row.mode === "llm-only" || row.mode === "rag";
    const point = baseMid * (isLlm ? assumption.ratio : 1) * pueFactor;
    const low = isLlm ? baseMid * ENERGY_UNCERTAINTY.lowRatio * pueFactor : point;
    const high = isLlm ? baseMid * ENERGY_UNCERTAINTY.highRatio * pueFactor : point;
    const energy: Band = { low, mid: point, high };
    const co2: Band = {
      low: co2GramsFromEnergy(low, grid.gPerKwh),
      mid: co2GramsFromEnergy(point, grid.gPerKwh),
      high: co2GramsFromEnergy(high, grid.gPerKwh),
    };
    const waterFull: Band = {
      low: waterMlFromEnergy(low, "fullScope"),
      mid: waterMlFromEnergy(point, "fullScope"),
      high: waterMlFromEnergy(high, "fullScope"),
    };
    const waterScope1: Band = {
      low: waterMlFromEnergy(low, "scope1"),
      mid: waterMlFromEnergy(point, "scope1"),
      high: waterMlFromEnergy(high, "scope1"),
    };
    return { row, energy, co2, waterFull, waterScope1, isLlm };
  });

  const energyData = derived.map((d) => ({
    label: d.row.label,
    value: d.energy.mid,
    displayValue: formatEnergyWh(d.energy.mid),
  }));
  const co2Data = derived.map((d) => ({
    label: d.row.label,
    value: d.co2.mid,
    displayValue: formatCo2Grams(d.co2.mid),
  }));
  const waterData = derived.map((d) => ({
    label: d.row.label,
    value: d.waterFull.mid,
    displayValue: formatWaterMl(d.waterFull.mid),
  }));

  const flat = derived.find((d) => d.row.mode === "flat");
  const rag = derived.find((d) => d.row.mode === "rag");

  const ragCostPerQuery = rag?.row.costPerQueryUsd ?? 0;
  const ragEnergy = rag?.energy ?? { low: 0, mid: 0, high: 0 };
  const ragCo2 = rag?.co2 ?? { low: 0, mid: 0, high: 0 };
  const ragWaterFull = rag?.waterFull ?? { low: 0, mid: 0, high: 0 };

  const costDeltaPerQuery = flat && rag ? rag.row.costPerQueryUsd - flat.row.costPerQueryUsd : null;
  const co2DeltaPerQuery = flat && rag ? rag.co2.mid - flat.co2.mid : null;

  // Org-scale: cost is measured (point); CO₂ and water are modeled (banded).
  const ragMonthlyCost = ragCostPerQuery * queriesPerDay * 30;
  const ragAnnualCost = ragCostPerQuery * queriesPerDay * 365;
  const projMonthly = (perQuery: number) => (perQuery * queriesPerDay * 30) / 1000; // → kg or L
  const ragMonthlyCo2Kg: Band = {
    low: projMonthly(ragCo2.low),
    mid: projMonthly(ragCo2.mid),
    high: projMonthly(ragCo2.high),
  };
  const ragAnnualCo2Kg = (ragCo2.mid * queriesPerDay * 365) / 1000;
  const ragMonthlyWaterL: Band = {
    low: projMonthly(ragWaterFull.low),
    mid: projMonthly(ragWaterFull.mid),
    high: projMonthly(ragWaterFull.high),
  };

  const annualCo2g = ragCo2.mid * queriesPerDay * 365;
  const kmDriven = annualCo2g / EQUIVALENTS.carGPerKm.value;
  const phoneCharges = annualCo2g / EQUIVALENTS.phoneChargeG.value;

  const fmtKg = (kg: number) => (kg < 0.01 ? `${(kg * 1000).toFixed(1)}g` : `${kg.toFixed(2)}kg`);
  const fmtL = (l: number) => (l < 0.01 ? "~0 L" : `${l.toFixed(1)} L`);

  function handlePreset(v: number) {
    setQueriesPerDay(v);
    setInputVal(String(v));
  }
  function handleInput(v: string) {
    const clean = v.replace(/\D/g, "");
    setInputVal(clean);
    const n = parseInt(clean, 10);
    if (!isNaN(n) && n > 0) setQueriesPerDay(n);
  }

  return (
    <section
      aria-labelledby="impact-heading"
      className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="impact-heading" className="text-lg font-bold text-text">
            {isLive ? "Step 4 — Impact Analytics" : "Impact Analytics"}
          </h3>
          <Link
            href="/methodology"
            className="text-sm font-medium text-accent-text underline underline-offset-2 hover:text-accent"
          >
            How we calculate this →
          </Link>
        </div>
        <p className="max-w-prose text-sm text-text-muted">
          {isLive
            ? `Derived from your run of ${queryCount ?? 0} ${queryCount === 1 ? "query" : "queries"}. `
            : "Sourced per-query estimates — each figure links to its coefficient. Run the benchmark above for your own live numbers. "}
          <strong className="font-semibold text-text">Latency, tokens, and cost are measured</strong> (from
          the Bedrock API); <strong className="font-semibold text-text">energy, water, and CO₂ are modeled</strong>{" "}
          from token count (~{ENERGY_WH_PER_1K_TOKENS} Wh per 1,000 tokens, anchored to Epoch AI&apos;s
          short-query figure), then × grid intensity and × PUE. All modeled figures are order-of-magnitude
          estimates, not measurements — see the{" "}
          <Link href="/methodology" className="underline hover:text-accent-text">methodology</Link>.
        </p>
      </div>

      {/* Flagship contrast */}
      <EnergyContrast />

      {/* Assumptions — grid intensity, PUE, per-token energy — all exposed, not buried */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
          Assumptions
          <InfoTooltip tip="Modeled energy/water/CO₂ recompute live as you change these. energy = tokens→Wh × (PUE / 1.2); CO₂ = energy(kWh) × grid intensity." />
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            <span className="font-semibold text-text">
              Grid carbon intensity<SourceCite figure={GRID_INTENSITY_SOURCE} label="src" />
            </span>
            <select
              value={gridId}
              onChange={(e) => setGridId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text focus:outline focus:outline-2 focus:outline-focus"
            >
              {GRID_OPTIONS.map((g) => (
                <option key={g.id} value={g.id}>{g.label} — {g.gPerKwh} gCO₂/kWh</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            <span className="font-semibold text-text">
              PUE (data-center overhead)<SourceCite figure={PUE_SOURCE} label="src" />
            </span>
            <select
              value={pueId}
              onChange={(e) => setPueId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text focus:outline focus:outline-2 focus:outline-focus"
            >
              {PUE_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label} — {p.value}×</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            <span className="font-semibold text-text">
              Per-token energy<SourceCite figure={ENERGY.chatShort} label="src" />
            </span>
            <select
              value={energyAssumptionId}
              onChange={(e) => setEnergyAssumptionId(e.target.value as typeof energyAssumptionId)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text focus:outline focus:outline-2 focus:outline-focus"
            >
              {ENERGY_ASSUMPTIONS.map((a) => (
                <option key={a.id} value={a.id}>{a.label} — {a.wh} Wh/short query</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-text-muted">
          Grid: {grid.note} · PUE: {pue.note} · Uncertainty band spans Epoch&apos;s {ENERGY_UNCERTAINTY.lowWh}–{ENERGY_UNCERTAINTY.highWh} Wh
          short-query range.
        </p>
      </div>

      {/* Per-mode charts — modeled */}
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-text">
          Modeled per-query impact <MetricBadge kind="modeled" />
        </p>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <BarChart title="Energy per query" unitLabel="Wh" data={energyData} />
            <p className="text-xs text-text-muted">
              RAG ≈ {fmtBand(formatEnergyWh, ragEnergy)}<SourceCite figure={ENERGY.chatShort} />.
              Lexical modes are retrieval-only (no LLM call).
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <BarChart title="CO₂ per query" unitLabel="grams CO₂" data={co2Data} />
            <p className="text-xs text-text-muted">
              RAG ≈ {fmtBand(formatCo2Grams, ragCo2)}. energy(kWh) × {grid.gPerKwh} gCO₂/kWh
              <SourceCite figure={GRID_INTENSITY_SOURCE} label="grid" />.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <BarChart title="Water per query (full-scope)" unitLabel="mL water" data={waterData} />
            <p className="text-xs text-text-muted">
              RAG ≈ {fmtBand(formatWaterMl, ragWaterFull)}<SourceCite figure={WATER.fullScopeGpt4o} />.
            </p>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Ranges are low–high uncertainty bands from Epoch AI&apos;s {ENERGY_UNCERTAINTY.lowWh}–{ENERGY_UNCERTAINTY.highWh} Wh
          short-query spread, scaled by your PUE selection.
        </p>
      </div>

      {/* Measured vs modeled legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-surface-2 px-4 py-3 text-xs text-text-muted">
        <span className="flex items-center gap-2"><MetricBadge kind="measured" /> latency · tokens · cost (Bedrock API)</span>
        <span className="flex items-center gap-2"><MetricBadge kind="modeled" /> energy · water · CO₂ (literature coefficients)</span>
      </div>

      {/* Scope-1 vs full-scope — never conflated */}
      <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
        <p className="flex items-center gap-2 font-semibold text-text">
          Two water numbers, two scopes
          <InfoTooltip tip="Scope-1 counts only water evaporated by on-site data-center cooling. Full-scope adds the water used to generate the electricity — roughly 4× larger. We chart full-scope and label it as such." />
        </p>
        <p className="mt-1 text-text-muted">
          <strong className="text-text">Scope-1 (on-site cooling):</strong> vendors disclose ~{WATER.scope1OpenAI.value} mL
          (OpenAI)<SourceCite figure={WATER.scope1OpenAI} /> and ~{WATER.scope1Gemini.value} mL median
          (Gemini)<SourceCite figure={WATER.scope1Gemini} /> per query.{" "}
          <strong className="text-text">Full-scope:</strong> a short GPT-4o query is ~{WATER.fullScopeGpt4o.value} mL
          once you count electricity generation<SourceCite figure={WATER.fullScopeGpt4o} />. The charts above show
          full-scope. {isLive ? "RAG this run" : "RAG"} ≈ {formatWaterMl(ragWaterFull.mid)} full-scope /
          {" "}{formatWaterMl(rag?.waterScope1.mid ?? 0)} scope-1 per query.
        </p>
      </div>

      {/* RAG vs Flat baseline delta */}
      {costDeltaPerQuery !== null && co2DeltaPerQuery !== null && (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-semibold text-text">
            RAG vs Flat baseline delta
            <InfoTooltip tip="How much more each RAG query costs and emits versus pure lexical (Flat) retrieval — the near-zero baseline." />
          </span>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              Cost: <span className="text-text">+{formatCost(costDeltaPerQuery)}/query</span>
              <MetricBadge kind="measured" />
            </span>
            <span className="flex items-center gap-1.5">
              CO₂: <span className="text-text">+{formatCo2Grams(co2DeltaPerQuery)}/query</span>
              <MetricBadge kind="modeled" />
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Flat and Hierarchical make no Bedrock call — ~0 marginal LLM energy, water, or cost beyond Lambda compute.
          </p>
        </div>
      )}

      {/* Org-scale projection */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-2 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
            Org-scale projection
            <InfoTooltip tip="RAG cost, CO₂, and water scale linearly with query volume. Cost is measured per query; CO₂ and water are modeled and shown with low–high ranges." />
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePreset(p)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  queriesPerDay === p
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface text-text-muted hover:text-text"
                }`}
              >
                {p.toLocaleString()}/day
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="qpd-input" className="text-xs text-text-muted">custom:</label>
            <input
              id="qpd-input"
              type="text"
              inputMode="numeric"
              value={inputVal}
              onChange={(e) => handleInput(e.target.value)}
              className="w-24 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text focus:outline focus:outline-2 focus:outline-focus"
              aria-label="Custom queries per day"
            />
            <span className="text-xs text-text-muted">/day</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-xs text-text-muted">RAG cost <MetricBadge kind="measured" /></p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text">
              ${ragMonthlyCost.toFixed(2)}
              <span className="text-xs font-normal text-text-muted">/mo</span>
            </p>
            <p className="font-mono text-xs text-text-muted">${ragAnnualCost.toFixed(0)}/yr</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-xs text-text-muted">RAG CO₂ <MetricBadge kind="modeled" /></p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text">
              {fmtKg(ragMonthlyCo2Kg.mid)}
              <span className="text-xs font-normal text-text-muted">/mo</span>
            </p>
            <p className="font-mono text-xs text-text-muted">
              ({fmtKg(ragMonthlyCo2Kg.low)}–{fmtKg(ragMonthlyCo2Kg.high)}) · {ragAnnualCo2Kg.toFixed(1)}kg/yr · {grid.gPerKwh} gCO₂/kWh
            </p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="flex items-center gap-1.5 text-xs text-text-muted">RAG water (full-scope) <MetricBadge kind="modeled" /></p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text">
              {fmtL(ragMonthlyWaterL.mid)}
              <span className="text-xs font-normal text-text-muted">/mo</span>
            </p>
            <p className="font-mono text-xs text-text-muted">({fmtL(ragMonthlyWaterL.low)}–{fmtL(ragMonthlyWaterL.high)}) · Lexical modes ≈ 0</p>
          </div>
        </div>

        <p className="text-xs text-text-muted">
          Annual RAG CO₂ ≈{" "}
          <span className="font-medium text-text">
            {kmDriven < 1 ? "<1 km" : kmDriven < 1000 ? `${Math.round(kmDriven)} km` : `${(kmDriven / 1000).toFixed(1)}k km`} driven
          </span>{" "}
          <SourceCite figure={EQUIVALENTS.carGPerKm} /> or{" "}
          <span className="font-medium text-text">
            {phoneCharges < 1000 ? Math.round(phoneCharges) : `${Math.round(phoneCharges / 1000)}k`} phone charges
          </span>
          <SourceCite figure={EQUIVALENTS.phoneChargeG} />. Rough equivalents for intuition only.
        </p>
      </div>
    </section>
  );
}
