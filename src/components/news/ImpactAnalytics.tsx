"use client";

import { useState } from "react";
import { benchmarkRows, type BenchmarkRow } from "@/lib/benchmark-data";
import { formatCost } from "@/lib/format";
import BarChart from "./BarChart";
import InfoTooltip from "@/components/ui/InfoTooltip";

const GRID_INTENSITY_G_PER_KWH = 400;
const CAR_G_CO2_PER_KM = 200;
const PHONE_CHARGE_G_CO2 = 8;
const PRESETS = [1_000, 10_000, 100_000];

interface ImpactAnalyticsProps {
  rows?: BenchmarkRow[];
  queryCount?: number;
}

function co2Grams(row: BenchmarkRow): number {
  return (row.energyPerQueryWh / 1000) * GRID_INTENSITY_G_PER_KWH;
}

export default function ImpactAnalytics({ rows, queryCount }: ImpactAnalyticsProps) {
  const data = rows ?? benchmarkRows;
  const isLive = Boolean(rows);

  const [queriesPerDay, setQueriesPerDay] = useState(10_000);
  const [inputVal, setInputVal] = useState("10000");

  const costData = data.map((row) => ({
    label: row.label,
    value: row.costPerQueryUsd,
    displayValue: formatCost(row.costPerQueryUsd),
  }));

  const co2Data = data.map((row) => {
    const grams = co2Grams(row);
    return {
      label: row.label,
      value: grams,
      displayValue: `${grams < 0.01 ? grams.toFixed(4) : grams.toFixed(2)}g`,
    };
  });

  const flatRow = data.find((r) => r.mode === "flat");
  const ragRow = data.find((r) => r.mode === "rag");
  const costDeltaPerQuery = flatRow && ragRow ? ragRow.costPerQueryUsd - flatRow.costPerQueryUsd : null;
  const co2DeltaPerQuery = flatRow && ragRow ? co2Grams(ragRow) - co2Grams(flatRow) : null;

  const ragCostPerQuery = ragRow?.costPerQueryUsd ?? 0;
  const flatCostPerQuery = flatRow?.costPerQueryUsd ?? 0;
  const ragCo2PerQuery = ragRow ? co2Grams(ragRow) : 0;

  const ragMonthlyCost = ragCostPerQuery * queriesPerDay * 30;
  const ragAnnualCost = ragCostPerQuery * queriesPerDay * 365;
  const flatMonthlyCost = flatCostPerQuery * queriesPerDay * 30;
  const ragMonthlyCo2Kg = (ragCo2PerQuery * queriesPerDay * 30) / 1000;
  const ragAnnualCo2Kg = (ragCo2PerQuery * queriesPerDay * 365) / 1000;

  const annualCo2g = ragCo2PerQuery * queriesPerDay * 365;
  const kmDriven = annualCo2g / CAR_G_CO2_PER_KM;
  const phoneCharges = annualCo2g / PHONE_CHARGE_G_CO2;

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
      <div>
        <h3 id="impact-heading" className="text-lg font-bold text-text">
          {isLive ? "Step 4 — Impact Analytics" : "Impact Analytics"}
        </h3>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          {isLive
            ? `From your run of ${queryCount ?? 0} ${queryCount === 1 ? "query" : "queries"}. `
            : "Illustrative — run the benchmark above to replace with live data. "}
          Grid intensity at {GRID_INTENSITY_G_PER_KWH} gCO₂/kWh. LLM/RAG energy derived from
          cost at ~2,615 Wh/$. All are order-of-magnitude estimates, not measurements.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <BarChart title="Estimated token cost per query" unitLabel="USD" data={costData} />
        <BarChart title="Estimated CO₂ per query" unitLabel="grams CO₂" data={co2Data} />
      </div>

      {/* Baseline delta */}
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
              CO₂:{" "}
              <span className="text-text">
                +{co2DeltaPerQuery < 0.01 ? co2DeltaPerQuery.toFixed(4) : co2DeltaPerQuery.toFixed(3)}g/query
              </span>
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Flat and Hierarchical cost nothing beyond Lambda compute — no Bedrock call, no LLM billing.
          </p>
        </div>
      )}

      {/* Scale estimator */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-2 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
            Org-scale projection
            <InfoTooltip tip="RAG cost scales linearly with query volume. Lexical modes cost ~$0 regardless of scale — only Lambda compute." />
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
            <p className="text-xs text-text-muted">Flat / Hierarchical cost</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text">
              {flatMonthlyCost < 0.01 ? "~$0" : `$${flatMonthlyCost.toFixed(2)}`}
              <span className="text-xs font-normal text-text-muted">/mo</span>
            </p>
            <p className="text-xs text-text-muted">Lambda compute only</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-xs text-text-muted">RAG CO₂ (est.)</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text">
              {ragMonthlyCo2Kg < 0.01
                ? `${(ragMonthlyCo2Kg * 1000).toFixed(1)}g`
                : `${ragMonthlyCo2Kg.toFixed(2)}kg`}
              <span className="text-xs font-normal text-text-muted">/mo</span>
            </p>
            <p className="font-mono text-xs text-text-muted">{ragAnnualCo2Kg.toFixed(1)}kg/yr</p>
          </div>
        </div>

        <p className="text-xs text-text-muted">
          Annual RAG CO₂ ≈{" "}
          <span className="font-medium text-text">
            {kmDriven < 1
              ? "<1km"
              : kmDriven < 1000
                ? `${Math.round(kmDriven)}km`
                : `${(kmDriven / 1000).toFixed(1)}k km`}{" "}
            driven
          </span>{" "}
          or{" "}
          <span className="font-medium text-text">
            {phoneCharges < 1000 ? Math.round(phoneCharges) : `${Math.round(phoneCharges / 1000)}k`} phone
            charges
          </span>
          . Rough order-of-magnitude only ({CAR_G_CO2_PER_KM} gCO₂/km, {PHONE_CHARGE_G_CO2} gCO₂/charge).
        </p>
      </div>
    </section>
  );
}
