import type { RetrievalResult } from "@/lib/search";
import { formatCost, formatLatency } from "@/lib/format";

interface ResultsPanelProps {
  result: RetrievalResult | null;
  pending: boolean;
}

export default function ResultsPanel({ result, pending }: ResultsPanelProps) {
  if (pending) {
    return (
      <div role="status" className="rounded-lg border border-border bg-surface p-6 text-sm text-text-muted">
        {result?.mode === "llm-only" || result?.mode === "rag"
          ? "Calling model (simulated)…"
          : "Searching…"}
      </div>
    );
  }

  if (!result || !result.query) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-text-muted">
        Enter a question above, or pick an example query, to see results for the selected mode.
      </div>
    );
  }

  const isGenerative = result.mode === "llm-only" || result.mode === "rag";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface-2 px-4 py-3 font-mono text-xs text-text-muted sm:text-sm">
        <span>
          latency <span className="font-medium text-text">{formatLatency(result.latencyMs)}</span>
        </span>
        <span aria-hidden="true" className="text-border">/</span>
        <span>
          cost <span className="font-medium text-text">{formatCost(result.costUsd)}</span>
        </span>
        {typeof result.docsFocused === "number" && (
          <>
            <span aria-hidden="true" className="text-border">/</span>
            <span>
              focused on{" "}
              <span className="font-medium text-text">
                {result.docsFocused} of {result.docsConsidered}
              </span>{" "}
              candidate docs
            </span>
          </>
        )}
        {result.simulated && (
          <>
            <span aria-hidden="true" className="text-border">/</span>
            <span className="text-accent-text">simulated generation, no live model call</span>
          </>
        )}
      </div>

      {isGenerative && result.answer && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {result.mode === "rag" ? "Generated answer (grounded)" : "Generated answer (ungrounded)"}
          </p>
          <p className="text-text">{result.answer}</p>
        </div>
      )}

      {result.matches.length > 0 && (
        <ul className="flex flex-col gap-3">
          {result.matches.map((match, i) => (
            <li key={match.chunk.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-text-muted">#{i + 1}</span>
                <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-muted">
                  {match.chunk.service}
                </span>
                <span className="text-sm font-medium text-text">{match.chunk.heading}</span>
              </div>
              <p className="text-sm text-text-muted">{match.snippet}</p>
              <a
                href={match.chunk.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-accent-text hover:underline"
              >
                View doc: {match.chunk.title}
              </a>
            </li>
          ))}
        </ul>
      )}

      {!isGenerative && result.matches.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-text-muted">
          No indexed snippets matched this query. Try one of the example queries, or a broader phrase.
        </div>
      )}
    </div>
  );
}
