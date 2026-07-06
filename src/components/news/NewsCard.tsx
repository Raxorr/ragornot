import type { NewsItem } from "@/lib/news-types";
import { formatRelativeTime } from "@/lib/format";

interface NewsCardProps {
  item: NewsItem;
  featured?: boolean;
}

export default function NewsCard({ item, featured }: NewsCardProps) {
  return (
    <article
      className={`flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 ${
        featured ? "lg:col-span-2" : ""
      }`}
    >
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
    </article>
  );
}
