"use client";

import { useMemo, useState } from "react";
import type { NewsItem, NewsTopic } from "@/lib/news-types";
import FilterBar from "./FilterBar";
import NewsCard from "./NewsCard";

type SortDir = "newest" | "oldest";
type TimeWindow = "week" | "2weeks" | "month" | "all";

const TIME_WINDOW_OPTIONS: Array<{ value: TimeWindow; label: string }> = [
  { value: "week",   label: "Past week" },
  { value: "2weeks", label: "Past 2 weeks" },
  { value: "month",  label: "Past month" },
  { value: "all",    label: "All time" },
];

function cutoffDate(window: TimeWindow): Date | null {
  const now = new Date();
  if (window === "week")   return new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  if (window === "2weeks") return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  if (window === "month")  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

interface NewsViewProps {
  items: NewsItem[];
}

export default function NewsView({ items }: NewsViewProps) {
  const [topic, setTopic]   = useState<NewsTopic | "All">("All");
  const [sort, setSort]     = useState<SortDir>("newest");
  const [window, setWindow] = useState<TimeWindow>("all");

  const filtered = useMemo(() => {
    const cutoff = cutoffDate(window);
    let list = topic === "All" ? items : items.filter((item) => item.topic === topic);
    if (cutoff) list = list.filter((item) => new Date(item.publishedAt) >= cutoff);
    return sort === "newest"
      ? [...list].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      : [...list].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  }, [items, topic, sort, window]);

  return (
    <div className="flex flex-col gap-10">
      <section aria-label="News feed" className="flex flex-col gap-4">
        {/* Topic chips */}
        <FilterBar active={topic} onChange={setTopic} />

        {/* Sort + time-window controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort toggle */}
          <div role="group" aria-label="Sort order" className="flex rounded-lg border border-border overflow-hidden text-sm">
            {(["newest", "oldest"] as SortDir[]).map((dir) => (
              <button
                key={dir}
                type="button"
                aria-pressed={sort === dir}
                onClick={() => setSort(dir)}
                className={`min-h-9 px-3 font-medium transition-colors ${
                  sort === dir
                    ? "bg-accent text-white"
                    : "bg-surface text-text-muted hover:text-text"
                }`}
              >
                {dir === "newest" ? "Newest first" : "Oldest first"}
              </button>
            ))}
          </div>

          {/* Time-window select */}
          <div role="group" aria-label="Time window" className="flex flex-wrap gap-2">
            {TIME_WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={window === opt.value}
                onClick={() => setWindow(opt.value)}
                className={`min-h-9 rounded-full border px-3 text-sm font-medium transition-colors ${
                  window === opt.value
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface text-text-muted hover:text-text"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-text-muted">
            No stories matching the current filters.
            {window !== "all" && " Try widening the time window."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item, i) => (
              <NewsCard key={item.id} item={item} featured={i === 0} />
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-text-muted">
        ragornot aggregates headlines and links to original sources. Full articles live on the
        publisher&rsquo;s site.
      </p>
    </div>
  );
}
