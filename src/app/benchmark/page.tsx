import type { Metadata } from "next";
import BenchmarkRunner from "@/components/benchmark/BenchmarkRunner";

export const metadata: Metadata = {
  title: "Benchmark — ragornot",
  description:
    "Run a live benchmark across all four retrieval modes — flat, hierarchical, LLM-only, and RAG — and compare latency, cost, and quality against the AWS docs corpus.",
};

export default function BenchmarkPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 sm:py-14">
      <BenchmarkRunner />
    </div>
  );
}
