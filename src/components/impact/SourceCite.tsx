import type { SourcedFigure } from "@/lib/impact-data";

/**
 * A small, accessible source citation link. Renders a superscript "[src]" that
 * links to the coefficient's origin and exposes the full citation to screen
 * readers and on hover — so every derived figure on the page traces to a source.
 */
export default function SourceCite({ figure, label = "src" }: { figure: SourcedFigure; label?: string }) {
  const title = `${figure.source}${figure.scope ? ` — ${figure.scope}` : ""}`;
  return (
    <a
      href={figure.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="ml-0.5 align-super text-[0.65em] font-medium text-accent-text underline decoration-dotted underline-offset-2 hover:text-accent"
    >
      <span aria-hidden="true">[{label}]</span>
      <span className="sr-only">source: {title} (opens in a new tab)</span>
    </a>
  );
}
