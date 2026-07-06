"use client";

import { useMemo, useState } from "react";
import type { NewsItem, NewsTopic } from "@/lib/news-types";
import FilterBar from "./FilterBar";
import NewsCard from "./NewsCard";

interface NewsViewProps {
  items: NewsItem[];
}

export default function NewsView({ items }: NewsViewProps) {
  const [topic, setTopic] = useState<NewsTopic | "All">("All");

  const filtered = useMemo(
    () => (topic === "All" ? items : items.filter((item) => item.topic === topic)),
    [items, topic],
  );

  return (
    <div className="flex flex-col gap-10">
      <section aria-label="News feed" className="flex flex-col gap-4">
        <FilterBar active={topic} onChange={setTopic} />

        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-text-muted">
            No stories tagged {topic} right now.
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
