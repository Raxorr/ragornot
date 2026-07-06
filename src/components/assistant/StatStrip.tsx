import { assistantStats } from "@/lib/config";

// Marketing/benchmark numbers, not the live demo-corpus size — see the
// "Demo index" caption near the search results for the actual figures.
export default function StatStrip() {
  return (
    <dl
      aria-label="Assistant index stats"
      className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-border bg-surface-2 px-4 py-3 font-mono text-xs tracking-wide text-text-muted sm:text-sm"
    >
      {assistantStats.map((stat, i) => (
        <div key={stat.label} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true" className="text-border">/</span>}
          <dt className="sr-only">{stat.label}</dt>
          <dd>
            <span className="font-medium text-text">{stat.value}</span>{" "}
            <span className="uppercase">{stat.label}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
