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
  co2GramsFromEnergy,
  waterMlFromEnergy,
  formatEnergyWh,
  formatCo2Grams,
  formatWaterMl,
  EQUIVALENTS,
} from "@/lib/impact-data";
import { flags } from "@/lib/flags";
import BarChart from "@/components/news/BarChart";
import InfoTooltip from "@/components/ui/InfoTooltip";
import SourceCite from "./SourceCite";
import EnergyContrast from "./EnergyContrast";

const PRESETS = [1_000, 10_000, 100_000];

interface ImpactPanelProps {
  rows?: BenchmarkRow[];
  queryCount?: number;
}

/** Marginal per-query energy (Wh) for a mode — sourced, not ad-hoc. */
function modeEnergyWh(row: BenchmarkRow, isLive: boolean): number {
  if (row.mode === "flat") return RETRIEVAL_ONLY_ENERGY_WH.flat;
  if (row.mode === "hierarchical") return RETRIEVAL_ONLY_ENERGY_WH.hierarchical;
  // llm-only / rag: a live run derives energy from its token cost (anchored to
  // the Epoch short-query figure); illustrative mode uses the literature figure.
  return isLive && row.energyPerQueryWh > 0 ? row.energyPerQueryWh : ENERGY.chatShort.value;
}

export default function ImpactPanel({ rows, queryCount }: ImpactPanelProps) {
  const data = rows ?? benchmarkRows;
  const isLive = Boolean(rows);

  const [gridId, setGridId] = useState(DEFAULT_GRID.id);
  const grid = GRID_OPTIONS.find((g) => g.id === gridId) ?? DEFAULT_GRID;

  const [queriesPerDay, setQueriesPerDay] = useState(10_000);
  const [inputVal, setInputVal] = useState("10000");

  const derived = data.map((row) => {
    const energyWh = modeEnergyWh(row, isLive);
    return {
      row,
      energyWh,
      co2g: co2GramsFromEnergy(energyWh, grid.gPerKwh),
      waterFullMl: waterMlFromEnergy(energyWh, "fullScope"),
      waterScope1Ml: waterMlFromEnergy(energyWh, "scope1"),
    };
  });

  const energyData = derived.map((d) => ({
    label: d.row.label,
    value: d.energyWh,
    displayValue: formatEnergyWh(d.energyWh),
  }));
  const co2Data = derived.map((d) => ({
    label: d.row.label,
    value: d.co2g,
    displayValue: formatCo2Grams(d.co2g),
  }));
  const waterData = derived.map((d) => ({
    label: d.row.label,
    value: d.waterFullMl,
    displayValue: formatWaterMl(d.waterFullMl),
  }));

  const flat = derived.find((d) => d.row.mode === "flat");
  const rag = derived.find((d) => d.row.mode === "rag");

  const ragCostPerQuery = rag?.row.costPerQueryUsd ?? 0;
  const ragCo2PerQuery = rag?.co2g ?? 0;
  const ragWaterFullPerQuery = rag?.waterFullMl ?? 0;

  const costDeltaPerQuery = flat && rag ? rag.row.costPerQueryUsd - flat.row.costPerQueryUsd : null;
  const co2DeltaPerQuery = flat && rag ? rag.co2g - flat.co2g : null;

  const ragMonthlyCost = ragCostPerQuery * queriesPerDay * 30;
  const ragAnnualCost = ragCostPerQuery * queriesPerDay * 365;
  const ragMonthlyCo2Kg = (ragCo2PerQuery * queriesPerDay * 30) / 1000;
  const ragAnnualCo2Kg = (ragCo2PerQuery * queriesPerDay * 365) / 1000;
  const ragMonthlyWaterL = (ragWaterFullPerQuery * queriesPerDay * 30) / 1000;

  const annualCo2g = ragCo2PerQuery * queriesPerDay * 365;
  const kmDriven = annualCo2g / EQUIVALENTS.carGPerKm.value;
  const phoneCharges = annualCo2g / EQUIVALENTS.phoneChargeG.value;

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
          {flags.methodologyPage && (
            <Link
              href="/methodology"
              className="text-sm font-medium text-accent-text underline underline-offset-2 hover:text-accent"
            >
              How we calculate this →
            </Link>
          )}
        </div>
        <p className="max-w-prose text-sm text-text-muted">
          {isLive
            ? `Derived from your run of ${queryCount ?? 0} ${queryCount === 1 ? "query" : "queries"}. `
            : "Illustrative — run the benchmark above to replace with live data. "}
          Every figure is an <strong className="font-semibold text-text">order-of-magnitude estimate</strong>,
          not a measurement. ragornot runs Claude Haiku over a small demo corpus, so these frontier-model
          coefficients are literature-derived proxies applied to the modes — see the{" "}
          {flags.methodologyPage ? (
            <Link href="/methodology" className="underline hover:text-accent-text">methodology</Link>
          ) : (
            "methodology"
          )}
          .
        </p>
      </div>

      {/* Flagship contrast */}
      <EnergyContrast />

      {/* Grid intensity — the assumption, exposed not buried */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
        <label htmlFor="grid-intensity" className="flex items-center gap-1.5 text-sm font-semibold text-text">
          Grid carbon intensity
          <InfoTooltip tip="CO₂ = energy(kWh) × grid intensity. Pick the grid that matches where your inference runs — the default is US-ish (400 gCO₂/kWh); the global average is higher." />
        </label>
        <select
          id="grid-intensity"
          value={gridId}
          onChange={(e) => setGridId(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline focus:outline-2 focus:outline-focus"
        >
          {GRID_OPTIONS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label} — {g.gPerKwh} gCO₂/kWh
            </option>
          ))}
        </select>
        <span className="text-xs text-text-muted">{grid.note}</span>
      </div>

      {/* Per-mode charts */}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <BarChart title="Energy per query" unitLabel="Wh" data={energyData} />
          <p className="text-xs text-text-muted">
            LLM/RAG anchored to a short-query figure<SourceCite figure={ENERGY.chatShort} />; Flat/Hierarchical
            are retrieval-only (no LLM call).
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <BarChart title="CO₂ per query" unitLabel="grams CO₂" data={co2Data} />
          <p className="text-xs text-text-muted">
            energy(kWh) × {grid.gPerKwh} gCO₂/kWh<SourceCite figure={GRID_INTENSITY_SOURCE} label="grid" />.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <BarChart title="Water per query (full-scope)" unitLabel="mL water" data={waterData} />
          <p className="text-xs text-text-muted">
            Full-scope, incl. electricity generation<SourceCite figure={WATER.fullScopeGpt4o} />.
          </p>
        </div>
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
          full-scope. RAG this session ≈ {formatWaterMl(ragWaterFullPerQuery)} full-scope /
          {" "}{formatWaterMl(rag?.waterScope1Ml ?? 0)} scope-1 per query.
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
            <span>
              Cost: <span className="text-text">+{formatCost(costDeltaPerQuery)}/query</span>
            </span>
            <span>
              CO₂: <span className="text-text">+{formatCo2Grams(co2DeltaPerQuery)}/query</span>
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
            <InfoTooltip tip="RAG cost, CO₂, and water scale linearly with query volume. Lexical modes cost ~$0 and ~0 marginal energy regardless of scale." />
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
            <p className="text-xs text-text-muted">RAG cost</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text">
              ${ragMonthlyCost.toFixed(2)}
              <span className="text-xs font-normal text-text-muted">/mo</span>
            </p>
            <p className="font-mono text-xs text-text-muted">${ragAnnualCost.toFixed(0)}/yr</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-xs text-text-muted">RAG CO₂ (est.)</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text">
              {ragMonthlyCo2Kg < 0.01
                ? `${(ragMonthlyCo2Kg * 1000).toFixed(1)}g`
                : `${ragMonthlyCo2Kg.toFixed(2)}kg`}
              <span className="text-xs font-normal text-text-muted">/mo</span>
            </p>
            <p className="font-mono text-xs text-text-muted">{ragAnnualCo2Kg.toFixed(1)}kg/yr · {grid.gPerKwh} gCO₂/kWh</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-xs text-text-muted">RAG water (full-scope)</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text">
              {ragMonthlyWaterL < 0.01 ? "~0 L" : `${ragMonthlyWaterL.toFixed(1)} L`}
              <span className="text-xs font-normal text-text-muted">/mo</span>
            </p>
            <p className="text-xs text-text-muted">Lexical modes ≈ 0</p>
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
