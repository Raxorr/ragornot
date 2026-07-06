"use client";
import type { NewsItem } from "@/lib/news-types";
import { formatRelativeTime } from "@/lib/format";

const TOPIC_ACCENT: Record<string, string> = {
  RAG:         "bg-violet-500",
  LLM:         "bg-blue-500",
  Cost:        "bg-emerald-500",
  Environment: "bg-green-600",
  AI:          "bg-slate-400",
};

interface NewsCardProps {
  item: NewsItem;
  featured?: boolean;
}

export default function NewsCard({ item, featured }: NewsCardProps) {
  return (
    <article
      className={`flex flex-col rounded-lg border border-border bg-surface overflow-hidden ${
        featured ? "lg:col-span-2" : ""
      }`}
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="w-full aspect-[2/1] object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div
          className={`h-1 ${TOPIC_ACCENT[item.topic] ?? "bg-slate-400"}`}
          aria-hidden="true"
        />
      )}

      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 font-medium text-text-muted">
            {item.topic}
          </span>
          <span>{item.source}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.publishedAt}>{formatRelativeTime(item.publishedAt)}</time>
        </div>

        <h3 className="text-lg font-semibold leading-snug text-text">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {item.headline}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </h3>

        {item.summary && <p className="text-sm text-text-muted">{item.summary}</p>}
      </div>
    </article>
  );
}
