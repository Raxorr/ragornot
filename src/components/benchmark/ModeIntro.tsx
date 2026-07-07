"use client";

import { useState } from "react";

interface ModeDef {
  label: string;
  when: string;
  cost: string;
  detail: string;
}

const MODES: ModeDef[] = [
  {
    label: "Flat (Lexical / BM25)",
    when: "Best default for well-structured corpora where speed and zero cost matter most.",
    cost: "Free — no LLM call.",
    detail:
      "Runs a single BM25-style pass across every indexed chunk. Ranks them globally against the query. Simple, fast, and near-zero compute. Can surface off-topic chunks when the corpus spans unrelated documents.",
  },
  {
    label: "Hierarchical",
    when: "Improves over Flat when your corpus mixes documents on different topics.",
    cost: "Free — no LLM call.",
    detail:
      "Narrows retrieval in stages: document → section → chunk. The narrowing step filters out irrelevant documents before chunk-level scoring, which raises precision at the cost of a small extra compute pass.",
  },
  {
    label: "LLM-only",
    when: "Only useful as a baseline or when you have no indexable corpus.",
    cost: "Costs ~$0.00013 / query (Bedrock Haiku pricing).",
    detail:
      "Skips retrieval entirely. Sends the query straight to the LLM and returns its parametric answer. Fluent, but frequently wrong or generic on domain-specific questions — no grounding means hallucinations are common.",
  },
  {
    label: "RAG (Retrieval-Augmented Generation)",
    when: "Best accuracy for domain questions. Justified when correctness matters more than cost.",
    cost: "Costs ~$0.00041 / query. At 10k queries/day → ~$150/month.",
    detail:
      "Runs Hierarchical retrieval first, then feeds the top chunks as context to the LLM before generating an answer. Grounding the model in actual source text dramatically reduces hallucination and improves correctness.",
  },
];

const METRIC_DEFS = [
  {
    term: "Quality proxy",
    def: "BM25-derived score returned by the Lambda for each retrieval mode. This is the primary metric in the winner decision — the mode with the highest score wins. LLM-only has no retrieval step, so its quality proxy is null (treated as −1), which is why it rarely wins.",
  },
  {
    term: "Confidence",
    def: "Per-query retrieval score returned by the Lambda (0–1). 'Accuracy %' in the Mode Comparison table is avg_confidence × 100 from your live run. For LLM-only, confidence is null (no retrieval step).",
  },
  {
    term: "Winner logic",
    def: "Mode with the highest quality proxy wins. If two modes are within 5% of each other, latency breaks the tie. If they're also within 40ms of each other, it's a Tie. LLM-only rarely wins because it has no quality proxy.",
  },
  {
    term: "Latency",
    def: "Measured end-to-end in the browser using performance.now() around the full fetch() call, including network round-trip. Not Lambda-only execution time.",
  },
  {
    term: "Cost / query",
    def: "data.llm_stats.cost_usd from the Lambda — Bedrock billing cost for that query. Exactly $0 for Flat and Hierarchical (no LLM call). For LLM-only and RAG, it reflects input + output token pricing.",
  },
  {
    term: "Energy estimate",
    def: "Derived from cost using ~2,615 Wh/$ (a calibration constant in the code). Lexical modes use fixed near-zero figures (0.6 mWh Flat, 0.9 mWh Hierarchical). CO₂ = energy × 400 gCO₂/kWh. All are order-of-magnitude estimates, not measurements.",
  },
];

export default function ModeIntro() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-text">
          How this works — modes, scores, and what to look for
        </span>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <p className="mb-4 max-w-prose text-sm text-text-muted">
            The benchmark runs {7} queries through each mode against a live 116-doc AWS
            documentation corpus. The results answer one question: <strong className="text-text">is RAG worth the extra cost for your use case?</strong>
          </p>

          {/* Mode definitions */}
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Retrieval modes
          </h4>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {MODES.map((m) => (
              <div key={m.label} className="rounded-md border border-border bg-surface-2 p-3">
                <p className="mb-1 text-sm font-semibold text-text">{m.label}</p>
                <p className="mb-1 text-xs text-text-muted">{m.detail}</p>
                <p className="text-xs text-text-muted">
                  <span className="font-medium text-text">When: </span>{m.when}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  <span className="font-medium text-text">Cost: </span>{m.cost}
                </p>
              </div>
            ))}
          </div>

          {/* Score definitions */}
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
            How scores are measured
          </h4>
          <dl className="space-y-2">
            {METRIC_DEFS.map((d) => (
              <div key={d.term} className="text-xs">
                <dt className="inline font-semibold text-text">{d.term}: </dt>
                <dd className="inline text-text-muted">{d.def}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
