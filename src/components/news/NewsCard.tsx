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
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${item.headline} (opens in a new tab)`}
      className={[
        "group flex flex-col rounded-lg border border-border bg-surface overflow-hidden",
        "transition-all duration-200 ease-in-out",
        "hover:border-accent hover:[box-shadow:0_0_0_2px_var(--accent),0_4px_24px_-4px_var(--accent)]",
        "motion-safe:hover:scale-[1.015]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus",
        featured ? "lg:col-span-2" : "",
      ].join(" ")}
    >
      {item.imageUrl ? (
        // Plain <img>: thumbnails are arbitrary remote RSS URLs and the site is a
        // static export (output: "export"), where next/image optimization is
        // unavailable — so <img> with lazy loading + graceful onError is correct here.
        // eslint-disable-next-line @next/next/no-img-element
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

        <p className="text-lg font-semibold leading-snug text-text group-hover:text-accent-text transition-colors duration-150">
          {item.headline}
        </p>

        {item.summary && (
          <p className="text-sm text-text-muted">{item.summary}</p>
        )}
      </div>
    </a>
  );
}
