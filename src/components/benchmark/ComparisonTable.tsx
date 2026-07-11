import { benchmarkRows, type BenchmarkRow } from "@/lib/benchmark-data";
import { formatCost, formatLatency } from "@/lib/format";
import InfoTooltip from "@/components/ui/InfoTooltip";

interface ComparisonTableProps {
  rows?: BenchmarkRow[];
}

/** Green "measured" tag — these columns come straight from the Bedrock API, not a model. */
function Measured() {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ color: "#16a34a", backgroundColor: "rgba(22,163,74,0.15)" }}
    >
      measured
    </span>
  );
}

const RELEVANCE_TIP =
  "Retrieval relevance — a lexical (BM25 / query-term) match confidence for how relevant the retrieved chunks are, NOT whether the final answer is correct. For live runs: avg_confidence × 100 (0–1 → %). LLM-only has no retrieval step so it shows N/A. Static numbers are illustrative from demo corpus runs. End-answer evaluation (correctness, faithfulness) is a planned future metric.";

const LATENCY_TIP =
  "End-to-end time measured in the browser with performance.now() around the full fetch() call — includes network round-trip, not just Lambda execution.";

const COST_TIP =
  "data.llm_stats.cost_usd from the Lambda — Bedrock token billing cost. Exactly $0.00000 for Flat and Hierarchical (no LLM call). For LLM-only and RAG, reflects input + output token pricing.";

export default function ComparisonTable({ rows }: ComparisonTableProps) {
  const data = rows ?? benchmarkRows;
  // LLM-only has no retrieval step, so it has no retrieval-relevance proxy —
  // it must read N/A, not a placeholder number. Scale the bars off the modes
  // that actually have a relevance figure.
  const relevanceRows = data.filter((r) => r.mode !== "llm-only");
  const maxRelevance = relevanceRows.length ? Math.max(...relevanceRows.map((r) => r.relevancePct)) : 1;

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
            Relevance (retrieval proxy), latency, and cost per query for each retrieval mode
          </caption>
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th scope="col" className="px-4 py-3 font-semibold text-text">Mode</th>
              <th scope="col" className="px-4 py-3 font-semibold text-text">
                <span className="flex items-center gap-1.5">
                  Relevance (proxy)
                  <InfoTooltip tip={RELEVANCE_TIP} />
                </span>
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-text">
                <span className="flex items-center gap-1.5">
                  Latency <Measured />
                  <InfoTooltip tip={LATENCY_TIP} />
                </span>
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-text">
                <span className="flex items-center gap-1.5">
                  Cost / query <Measured />
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
                  {row.mode === "llm-only" ? (
                    <span
                      className="font-mono text-text-muted"
                      title="LLM-only has no retrieval step, so there is no retrieval-relevance proxy."
                    >
                      N/A
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 font-mono">
                      <span className="w-10 shrink-0 text-text">{row.relevancePct}%</span>
                      <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${(row.relevancePct / maxRelevance) * 100}%` }}
                        />
                      </span>
                    </div>
                  )}
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
