import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { NewsItem } from "@/lib/news-types";
import NewsView from "@/components/news/NewsView";

export const metadata: Metadata = {
  title: "News — ragornot",
};

// Read straight from public/news.json at render time (this page has no
// dynamic APIs, so it still prerenders as static output — including under
// `output: "export"`). scripts/fetch-news.mjs overwrites that file on a
// schedule; this just reads whatever's there.
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
          AI, LLM, and RAG coverage, refreshed on a schedule by scripts/fetch-news.mjs — plus the cost
          and environmental footprint behind an LLM-generated answer.
        </p>
      </div>
      <NewsView items={items} />
    </div>
  );
}
