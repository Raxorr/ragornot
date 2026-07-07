import type { Metadata } from "next";
import BenchmarkRunner from "@/components/benchmark/BenchmarkRunner";

export const metadata: Metadata = {
  title: "Benchmark — ragornot",
  description:
    "Run a live benchmark across all four retrieval modes — flat, hierarchical, LLM-only, and RAG — and compare latency, cost, and quality against the AWS docs corpus.",
};

export default function BenchmarkPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      {/* Hero */}
      <section className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          RAG or not — compare. learn. decide.
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
          Live Benchmark
        </h1>
        <p className="max-w-2xl text-lg text-text-muted">
          Run 7 real AWS-docs queries through four retrieval strategies and get empirical numbers on
          cost, latency, answer quality, and carbon — so you can decide whether RAG is worth it
          for your organisation.
        </p>
        <div className="flex flex-wrap gap-6 text-sm text-text-muted">
          <span>
            <span className="font-semibold text-text">Flat &amp; Hierarchical:</span> near-zero cost, millisecond latency
          </span>
          <span>
            <span className="font-semibold text-text">RAG:</span> highest accuracy, ~$0.00041/query
          </span>
          <span>
            <span className="font-semibold text-text">LLM-only:</span> no grounding — the control baseline
          </span>
        </div>
      </section>

      <BenchmarkRunner />
    </div>
  );
}
