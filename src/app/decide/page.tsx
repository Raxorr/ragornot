import type { Metadata } from "next";
import Link from "next/link";
import DecideTool from "@/components/decide/DecideTool";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "RAG or not?",
  description:
    "A short, honest questionnaire that tells you whether to use RAG, lexical search, long-context, fine-tuning — or no AI at all — with the cost and energy tradeoff for each, from cited data.",
  alternates: { canonical: absoluteUrl("/decide") },
};

export default function DecidePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          RAG or not — decide.
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
          Do you actually need RAG?
        </h1>
        <p className="max-w-prose text-lg text-text-muted">
          Eight quick questions, one clear recommendation — RAG, lexical search, long-context,
          fine-tuning, or nothing at all — each with the real cost and energy tradeoff. The logic is a
          fixed decision tree you can inspect, and it&apos;s happy to tell you that you don&apos;t need
          RAG. Curious how the two options compare live? Run the{" "}
          <Link href="/benchmark" className="underline hover:text-accent-text">Benchmark</Link>.
        </p>
      </header>

      <DecideTool />
    </div>
  );
}
