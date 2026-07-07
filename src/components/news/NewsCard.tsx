"use client";
import type { NewsItem } from "@/lib/news-types";
import { getSourceUrl } from "@/lib/news-categories";
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
  const sourceUrl = getSourceUrl(item);

  return (
    // Stretch-link pattern: the <a> below covers the whole card at z-0;
    // content is pointer-events-none so clicks fall through to it.
    // "More from Source" re-enables pointer-events for that element only.
    <article
      className={[
        "group relative flex flex-col rounded-lg border border-border bg-surface overflow-hidden",
        "transition-all duration-200 ease-in-out",
        "hover:border-accent hover:[box-shadow:0_0_0_2px_var(--accent),0_4px_24px_-4px_var(--accent)]",
        "motion-safe:hover:scale-[1.015]",
        featured ? "lg:col-span-2" : "",
      ].join(" ")}
    >
      {/* Stretch link — covers the whole card; keyboard: Tab focuses this, Enter opens article */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${item.headline} (opens in a new tab)`}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      />

      {/* Image or color-bar accent — pointer-events-none so clicks pass through */}
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="pointer-events-none relative z-10 w-full aspect-[2/1] object-cover"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      ) : (
        <div
          className={`pointer-events-none relative z-10 h-1 ${TOPIC_ACCENT[item.topic] ?? "bg-slate-400"}`}
          aria-hidden="true"
        />
      )}

      {/* Main content — pointer-events-none so mouse clicks reach the stretch link */}
      <div className="pointer-events-none relative z-10 flex flex-col gap-3 p-5 flex-1">
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

      {/* "More from Source" — pointer-events-auto re-enables clicks for this link only */}
      {sourceUrl && (
        <div className="relative z-10 px-5 pb-4">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto text-xs text-text-muted underline-offset-2 hover:underline hover:text-accent-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus rounded"
          >
            More from {item.source} →
          </a>
        </div>
      )}
    </article>
  );
}
