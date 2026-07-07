import { benchmarkRows, type BenchmarkRow } from "@/lib/benchmark-data";
import { formatCost } from "@/lib/format";
import BarChart from "./BarChart";

const GRID_INTENSITY_G_PER_KWH = 400;

interface ImpactAnalyticsProps {
  rows?: BenchmarkRow[];
  queryCount?: number;
}

export default function ImpactAnalytics({ rows, queryCount }: ImpactAnalyticsProps) {
  const data = rows ?? benchmarkRows;
  const isLive = Boolean(rows);

  const costData = data.map((row) => ({
    label: row.label,
    value: row.costPerQueryUsd,
    displayValue: formatCost(row.costPerQueryUsd),
  }));

  const co2Data = data.map((row) => {
    const grams = (row.energyPerQueryWh / 1000) * GRID_INTENSITY_G_PER_KWH;
    return {
      label: row.label,
      value: grams,
      displayValue: `${grams < 0.01 ? grams.toFixed(4) : grams.toFixed(2)}g`,
    };
  });

  return (
    <section
      aria-labelledby="impact-heading"
      className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-5 sm:p-6"
    >
      <div>
        <h3 id="impact-heading" className="text-lg font-bold text-text">
          Impact Analytics
        </h3>
        <p className="mt-1 max-w-prose text-sm text-text-muted">
          {isLive
            ? `Computed from your last run of ${queryCount ?? 0} ${queryCount === 1 ? "query" : "queries"}. `
            : "Sample data — run a benchmark above to see live numbers. "}
          The cost of an LLM-generated answer versus lexical retrieval, per query. Grid intensity
          assumed at {GRID_INTENSITY_G_PER_KWH} gCO₂/kWh — an order-of-magnitude estimate, not a
          measurement. LLM/RAG energy derived from measured token cost (~2600 Wh/$).
        </p>
      </div>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <BarChart title="Estimated token cost per query" unitLabel="USD" data={costData} />
        <BarChart title="Estimated CO₂ per query" unitLabel="grams CO₂" data={co2Data} />
      </div>
    </section>
  );
}
