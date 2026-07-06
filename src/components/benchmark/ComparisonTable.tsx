import { benchmarkRows } from "@/lib/benchmark-data";
import { formatCost, formatLatency } from "@/lib/format";

export default function ComparisonTable() {
  const maxAccuracy = Math.max(...benchmarkRows.map((r) => r.accuracyPct));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">
          Accuracy, latency, and cost per query for each retrieval mode over the demo corpus
        </caption>
        <thead>
          <tr className="border-b border-border bg-surface-2">
            <th scope="col" className="px-4 py-3 font-semibold text-text">
              Mode
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-text">
              Accuracy
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-text">
              Latency
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-text">
              Cost / query
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-text">
              What it means
            </th>
          </tr>
        </thead>
        <tbody>
          {benchmarkRows.map((row) => (
            <tr key={row.mode} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-4 py-4 align-top font-medium text-text">
                {row.label}
              </th>
              <td className="px-4 py-4 align-top">
                <div className="flex items-center gap-2 font-mono">
                  <span className="w-10 shrink-0 text-text">{row.accuracyPct}%</span>
                  {/* Fixed width, not flex-1: table auto-layout sizes this
                      column to its content, so a flex-grown track would
                      have almost nothing to grow into. */}
                  <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${(row.accuracyPct / maxAccuracy) * 100}%` }}
                    />
                  </span>
                </div>
              </td>
              <td className="px-4 py-4 align-top font-mono text-text">{formatLatency(row.latencyMs)}</td>
              <td className="px-4 py-4 align-top font-mono text-text">{formatCost(row.costPerQueryUsd)}</td>
              <td className="px-4 py-4 align-top text-text-muted">{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
