import { ENERGY } from "@/lib/impact-data";
import SourceCite from "./SourceCite";

/**
 * The flagship comparison: answering with RETRIEVAL (~0.3 Wh) vs stuffing a
 * ~100k-token document into CONTEXT (~40 Wh) — about 100× the energy. Rendered
 * as two proportional bars so the gap is visual, not just numeric.
 */
export default function EnergyContrast({ compact = false }: { compact?: boolean }) {
  const retrieval = ENERGY.chatShort.value; // 0.3 Wh
  const longContext = ENERGY.longContext.value; // 40 Wh
  const ratio = Math.round(longContext / retrieval); // ~133 → we say "~100×"

  const rows = [
    {
      key: "retrieval",
      name: "Retrieval-grounded answer",
      detail: "Fetch only the relevant chunks",
      wh: retrieval,
      cite: ENERGY.chatShort,
      barClass: "bg-accent",
    },
    {
      key: "longcontext",
      name: "Stuff a long document into context",
      detail: "~100k tokens attached to the query",
      wh: longContext,
      cite: ENERGY.longContext,
      barClass: "bg-text-muted",
    },
  ];

  return (
    <section
      aria-labelledby="energy-contrast-heading"
      className="flex flex-col gap-4 rounded-lg border border-accent/40 bg-surface-2 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          The order-of-magnitude that matters
        </p>
        <h3 id="energy-contrast-heading" className="text-lg font-bold text-text sm:text-xl">
          Retrieval ≈ {retrieval} Wh &nbsp;vs&nbsp; long-context ≈ {longContext} Wh
          <span className="text-accent-text"> — ~100× the energy</span>
        </h3>
      </div>

      <div className="flex flex-col gap-3" aria-hidden="true">
        {rows.map((r) => (
          <div key={r.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-text">{r.name}</span>
              <span className="font-mono text-sm font-semibold text-text">{r.wh} Wh</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full rounded-full ${r.barClass}`}
                style={{ width: `${Math.max((r.wh / longContext) * 100, 1.5)}%` }}
              />
            </div>
            {!compact && <span className="text-xs text-text-muted">{r.detail}</span>}
          </div>
        ))}
      </div>

      {/* Accessible text equivalent of the bars. */}
      <p className="sr-only">
        A retrieval-grounded answer uses about {retrieval} watt-hours; attaching a roughly
        100,000-token document to the query uses about {longContext} watt-hours — around {ratio} times
        more energy.
      </p>

      <p className="max-w-prose text-sm text-text-muted">
        Retrieval sends the model only what&apos;s relevant, so each answer stays near a short-query
        energy budget
        <SourceCite figure={ENERGY.chatShort} />. Attaching a large document to every prompt pays
        the full long-context tax on every call
        <SourceCite figure={ENERGY.longContext} />. Same answer, ~100× the energy — the whole reason
        to ask &ldquo;RAG or not?&rdquo; before reaching for a giant context window. Order-of-magnitude
        estimate, not a measurement.
      </p>
    </section>
  );
}
