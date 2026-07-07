import { benchmarkRows, type BenchmarkRow } from "@/lib/benchmark-data";
import { formatCost, formatLatency } from "@/lib/format";
import InfoTooltip from "@/components/ui/InfoTooltip";

interface ComparisonTableProps {
  rows?: BenchmarkRow[];
}

const ACCURACY_TIP =
  "For live runs: avg_confidence × 100, where confidence is the retrieval model's score for how relevant the top chunks were (0–1). LLM-only has no retrieval step so it shows no confidence. Static numbers are illustrative from demo corpus runs.";

const LATENCY_TIP =
  "End-to-end time measured in the browser with performance.now() around the full fetch() call — includes network round-trip, not just Lambda execution.";

const COST_TIP =
  "data.llm_stats.cost_usd from the Lambda — Bedrock token billing cost. Exactly $0.00000 for Flat and Hierarchical (no LLM call). For LLM-only and RAG, reflects input + output token pricing.";

export default function ComparisonTable({ rows }: ComparisonTableProps) {
  const data = rows ?? benchmarkRows;
  const maxAccuracy = Math.max(...data.map((r) => r.accuracyPct));

  const flatRow = data.find((r) => r.mode === "flat");
  const ragRow = data.find((r) => r.mode === "rag");
  const costDelta =
    flatRow && ragRow ? ragRow.costPerQueryUsd - flatRow.costPerQueryUsd : null;

  return (
    <div className="flex flex-col gap-3">
      {costDelta !== null && costDelta > 0 && (
        <p className="text-xs text-text-muted">
          <span className="font-medium text-text">RAG vs Flat baseline:</span>
          {" "}adds <span className="font-mono text-text">${costDelta.toFixed(5)}</span> per query in LLM cost —
          free retrieval modes cost nothing beyond Lambda compute.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Accuracy, latency, and cost per query for each retrieval mode
          </caption>
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th scope="col" className="px-4 py-3 font-semibold text-text">Mode</th>
              <th scope="col" className="px-4 py-3 font-semibold text-text">
                <span className="flex items-center gap-1.5">
                  Accuracy
                  <InfoTooltip tip={ACCURACY_TIP} />
                </span>
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-text">
                <span className="flex items-center gap-1.5">
                  Latency
                  <InfoTooltip tip={LATENCY_TIP} />
                </span>
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-text">
                <span className="flex items-center gap-1.5">
                  Cost / query
                  <InfoTooltip tip={COST_TIP} />
                </span>
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-text">What it means for your org</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.mode} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-4 align-top font-medium text-text">
                  {row.label}
                </th>
                <td className="px-4 py-4 align-top">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="w-10 shrink-0 text-text">{row.accuracyPct}%</span>
                    <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${(row.accuracyPct / maxAccuracy) * 100}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 align-top font-mono text-text">
                  {formatLatency(row.latencyMs)}
                </td>
                <td className="px-4 py-4 align-top font-mono text-text">
                  {formatCost(row.costPerQueryUsd)}
                </td>
                <td className="px-4 py-4 align-top text-text-muted">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
