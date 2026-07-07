import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { NewsItem } from "@/lib/news-types";
import NewsView from "@/components/news/NewsView";

export const metadata: Metadata = {
  title: "News — ragornot",
};

// Read public/news.json at build time for the initial paint (fast first
// render + SEO + offline fallback). NewsView then re-fetches the committed
// file from GitHub raw on mount, so a hard refresh always shows the current
// hourly-cron file without waiting for a Pages rebuild.
function loadNews(): NewsItem[] {
  const filePath = path.join(process.cwd(), "public", "news.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const items = JSON.parse(raw) as NewsItem[];
  return items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export default function NewsPage() {
  const items = loadNews();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-text sm:text-4xl">News</h1>
        <p className="max-w-prose text-text-muted">
          The retrieval and AI landscape — RAG, LLMs, cost, efficiency, and the models behind them.
          Refreshed hourly. See the <a href="/benchmark" className="underline hover:text-accent-text">Benchmark</a> tab
          for the empirical cost and quality numbers behind these technologies.
        </p>
      </div>
      <NewsView initialItems={items} />
    </div>
  );
}
