import type { ApiResponse } from "@/lib/api";
import { formatCost, formatLatency } from "@/lib/format";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface ApiResultsPanelProps {
  result: ApiResponse | null;
  latencyMs: number;
  pending: boolean;
  mode: string;
}

export default function ApiResultsPanel({ result, latencyMs, pending, mode }: ApiResultsPanelProps) {
  if (pending) {
    return (
      <div role="status" className="rounded-lg border border-border bg-surface p-6 text-sm text-text-muted">
        {mode === "llm" || mode === "rag" ? "Calling model on AWS Bedrock…" : "Searching…"}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-text-muted">
        Enter a question above, or pick an example query, to see results for the selected mode.
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-accent-text">
        {result.error}
      </div>
    );
  }

  const isGenerative = result.mode === "llm" || result.mode === "rag";
  const costUsd = result.llm_stats?.cost_usd ?? 0;
  const confidence = typeof result.confidence === "number"
    ? `${(result.confidence * 100).toFixed(1)}%`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface-2 px-4 py-3 font-mono text-xs text-text-muted sm:text-sm">
        <span>
          latency <span className="font-medium text-text">{formatLatency(latencyMs)}</span>
        </span>
        <span aria-hidden="true" className="text-border">/</span>
        <span>
          cost <span className="font-medium text-text">{formatCost(costUsd)}</span>
        </span>
        {confidence && (
          <>
            <span aria-hidden="true" className="text-border">/</span>
            <span>
              confidence <span className="font-medium text-text">{confidence}</span>
            </span>
          </>
        )}
        {result.llm_stats && (
          <>
            <span aria-hidden="true" className="text-border">/</span>
            <span>
              tokens <span className="font-medium text-text">
                {result.llm_stats.input_tokens + result.llm_stats.output_tokens}
              </span>
            </span>
            <span aria-hidden="true" className="text-border">/</span>
            <span className="truncate">
              model <span className="font-medium text-text">{result.llm_stats.model}</span>
            </span>
          </>
        )}
      </div>

      {isGenerative && result.answer_text && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {result.mode === "rag" ? "Generated answer (grounded)" : "Generated answer (ungrounded)"}
          </p>
          <MarkdownRenderer content={result.answer_text} />
          <p className="mt-3 text-xs text-text-muted">
            AI-generated — may be inaccurate or outdated. Verify against{" "}
            <a
              href="https://docs.aws.amazon.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-accent-text"
            >
              official AWS docs
            </a>.
          </p>
        </div>
      )}

      {isGenerative && result.answer_bullets.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {result.mode === "rag" ? "Key points (grounded)" : "Key points (ungrounded)"}
          </p>
          <ul className="flex flex-col gap-1">
            {result.answer_bullets.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-text">
                <span className="shrink-0 font-mono text-text-muted">{i + 1}.</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.matches.length > 0 && (
        <ul className="flex flex-col gap-3">
          {result.matches.map((match, i) => (
            <li key={i} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-text-muted">#{i + 1}</span>
                {match.heading && (
                  <span className="text-sm font-medium text-text">{match.heading}</span>
                )}
              </div>
              <p className="text-sm text-text-muted">{match.snippet}</p>
              <a
                href={match.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-accent-text hover:underline"
              >
                View doc: {match.title}
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
