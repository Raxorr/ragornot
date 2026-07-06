import type { Metadata } from "next";
import { site } from "@/lib/config";
import StatStrip from "@/components/assistant/StatStrip";
import ExploreView from "@/components/explore/ExploreView";

export const metadata: Metadata = {
  title: "Explore — ragornot",
  description:
    "Ask questions about AWS documentation and compare flat, hierarchical, LLM-only, and RAG retrieval modes — live, with real latency and cost.",
};

export default function ExplorePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <section className="flex flex-col gap-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">{site.eyebrow}</p>
        <h1 className="text-4xl tracking-tight sm:text-5xl">
          <span className="font-extrabold text-text">rag</span>
          <span className="font-normal text-text-muted">ornot</span>
        </h1>
        <p className="max-w-prose text-lg text-text-muted">{site.heroSubtitle}</p>
        <StatStrip />
      </section>

      <section aria-labelledby="explore-heading" className="flex flex-col gap-4">
        <h2 id="explore-heading" className="text-2xl font-bold tracking-tight text-text">
          Explore
        </h2>
        <ExploreView />
      </section>
    </div>
  );
}
