"use client";

import { assistantStats } from "@/lib/config";
import { useExploreStats } from "@/components/explore/ExploreStatsContext";

// Explore hero stat strip. The first two entries are static facts; the last two
// are session-scoped and reflect real queries run this session — 0 LLM calls and
// no latency claim at rest, updating live as the user runs Flat/LLM/RAG queries.
export default function StatStrip() {
  const stats = useExploreStats();
  const avgLatencyMs = stats?.avgLatencyMs ?? null;
  const llmCalls = stats?.llmCalls ?? 0;

  const items = [
    ...assistantStats,
    { label: "avg latency (session)", value: avgLatencyMs === null ? "—" : `${avgLatencyMs}ms` },
    { label: "LLM calls (session)", value: String(llmCalls) },
  ];

  return (
    <dl
      aria-label="Explore index and session stats"
      className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-border bg-surface-2 px-4 py-3 font-mono text-xs tracking-wide text-text-muted sm:text-sm"
    >
      {items.map((stat, i) => (
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
