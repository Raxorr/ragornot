import Link from "next/link";
import type { Metadata } from "next";
import StatStrip from "@/components/assistant/StatStrip";
import ExploreView from "@/components/explore/ExploreView";
import { ExploreStatsProvider } from "@/components/explore/ExploreStatsContext";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Explore",
  description:
    "Ask questions about AWS documentation and compare flat, hierarchical, LLM-only, and RAG retrieval modes — live, with real latency and cost.",
  alternates: { canonical: absoluteUrl("/explore") },
};

export default function ExplorePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      {/* Provider shares the session stats between the hero strip and the query flow. */}
      <ExploreStatsProvider>
        <section className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
            Try it yourself
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
            Explore
          </h1>
          <p className="max-w-prose text-lg text-text-muted">
            Run any question through the same four retrieval modes the{" "}
            <Link href="/benchmark" className="underline hover:text-accent-text">
              Benchmark
            </Link>{" "}
            uses — Flat, Hierarchical, LLM-only, and RAG — and see the latency, cost, and answer
            quality tradeoff for yourself, one query at a time.
          </p>
          <StatStrip />
        </section>

        <section aria-labelledby="explore-heading" className="flex flex-col gap-4">
          <h2 id="explore-heading" className="text-2xl font-bold tracking-tight text-text">
            Ask a question
          </h2>
          <ExploreView />
        </section>
      </ExploreStatsProvider>
    </div>
  );
}
