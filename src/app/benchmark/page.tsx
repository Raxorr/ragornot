import type { Metadata } from "next";
import BenchmarkRunner from "@/components/benchmark/BenchmarkRunner";
import ComparisonTable from "@/components/benchmark/ComparisonTable";
import ImpactAnalytics from "@/components/news/ImpactAnalytics";

export const metadata: Metadata = {
  title: "Benchmark — ragornot",
  description:
    "Run a live benchmark across all four retrieval modes — flat, hierarchical, LLM-only, and RAG — and compare latency, cost, and quality against the AWS docs corpus.",
};

export default function BenchmarkPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 sm:py-14">
      <BenchmarkRunner />

      <section aria-labelledby="comparison-heading" className="flex flex-col gap-4">
        <h2 id="comparison-heading" className="text-2xl font-bold tracking-tight text-text">
          Mode Comparison
        </h2>
        <p className="max-w-prose text-text-muted">
          Illustrative numbers from the demo corpus. Flat and Hierarchical are measured in-browser
          against the local index; LLM-only and RAG figures reflect live Bedrock call averages.
        </p>
        <ComparisonTable />
      </section>

      <ImpactAnalytics />
    </div>
  );
}
