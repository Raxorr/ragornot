"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  QUESTIONS,
  decide,
  isComplete,
  encodeAnswers,
  decodeAnswers,
  type Answers,
  type Outcome,
} from "@/lib/decide-logic";
import { absoluteUrl } from "@/lib/site-url";
import ShareCard from "@/components/share/ShareCard";
import type { ShareStat } from "@/lib/share-card";

const OUTCOME_TAG: Record<Outcome, string> = {
  rag: "Recommended: RAG",
  lexical: "Recommended: Lexical search",
  "long-context": "Recommended: Long-context",
  "fine-tuning": "Recommended: Fine-tuning",
  none: "Recommended: No AI needed",
};

// The live comparison each recommendation should push the user toward. The
// Benchmark always runs all four modes, so this only tunes the CTA wording —
// the link goes to /benchmark either way.
const OUTCOME_CTA: Record<Outcome, string> = {
  rag: "See RAG vs Flat (lexical) live",
  lexical: "See Flat (lexical) vs RAG live",
  "long-context": "See RAG vs LLM-only live",
  "fine-tuning": "See RAG vs LLM-only live",
  none: "See Flat (lexical) vs RAG live",
};

// Two meaningful stat tiles per outcome for the shareable card — the recommended
// approach plus its key tradeoff/delta. Never a bare "0"/"~0" as a headline stat.
const OUTCOME_STATS: Record<Outcome, ShareStat[]> = {
  rag: [
    { label: "vs long-context", value: "~22× cheaper" },
    { label: "Energy/query", value: "~0.3 Wh" },
  ],
  lexical: [
    { label: "Retrieval latency", value: "<10 ms" },
    { label: "Energy saved/query", value: "~0.3 Wh" },
  ],
  "long-context": [
    { label: "vs RAG", value: "~22× the cost" },
    { label: "Energy/query", value: "~40 Wh" },
  ],
  "fine-tuning": [
    { label: "Prompt tokens", value: "↓ per query" },
    { label: "Tradeoff", value: "no citations" },
  ],
  none: [
    { label: "Better fit", value: "DB / index" },
    { label: "Energy saved/query", value: "~0.3 Wh" },
  ],
};

export default function DecideTool() {
  const [answers, setAnswers] = useState<Answers>({});
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState<null | "link" | "text">(null);

  // Restore answers from the URL hash on mount (so a shared link reproduces the
  // result). This is browser-only state that can't be read during SSR, so the
  // one-time setState here is the intended pattern — empty deps, no cascading loop.
  useEffect(() => {
    const fromUrl = decodeAnswers(window.location.hash);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (Object.keys(fromUrl).length > 0) setAnswers(fromUrl);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Keep the address-bar hash in sync so the URL is always shareable.
  useEffect(() => {
    if (!hydrated) return;
    const encoded = encodeAnswers(answers);
    const url = `${window.location.pathname}${encoded ? `#${encoded}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [answers, hydrated]);

  const recommendation = useMemo(() => decide(answers), [answers]);
  const answeredCount = QUESTIONS.filter((q) => answers[q.id]).length;
  const complete = isComplete(answers);

  function pick(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setCopied(null);
  }
  function reset() {
    setAnswers({});
    setCopied(null);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied("link");
    } catch {
      setCopied(null);
    }
  }

  async function copyText() {
    if (!recommendation) return;
    const text =
      `RAG or not? → ${recommendation.title}\n\n${recommendation.rationale}\n\nTradeoff: ${recommendation.tradeoff}\n\n${window.location.href}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied("text");
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-xs text-text-muted">
          {answeredCount}/{QUESTIONS.length}
        </span>
      </div>

      {/* Questionnaire */}
      <form className="flex flex-col gap-6">
        {QUESTIONS.map((q, i) => (
          <fieldset key={q.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
            <legend className="flex items-baseline gap-2 px-1 text-base font-semibold text-text">
              <span className="font-mono text-sm text-accent-text">{i + 1}.</span>
              {q.question}
            </legend>
            {q.help && <p className="text-sm text-text-muted">{q.help}</p>}
            <div className="flex flex-wrap gap-2">
              {q.options.map((o) => {
                const active = answers[q.id] === o.value;
                return (
                  <label
                    key={o.value}
                    className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-surface-2 text-text-muted hover:text-text"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={o.value}
                      checked={active}
                      onChange={() => pick(q.id, o.value)}
                      className="sr-only"
                    />
                    {o.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </form>

      {/* Result */}
      <div aria-live="polite">
        {!complete ? (
          <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-sm text-text-muted">
            Answer all {QUESTIONS.length} questions to see a recommendation. There&apos;s no wrong answer —
            the tool is happy to tell you that you don&apos;t need RAG, or don&apos;t need AI at all.
          </p>
        ) : (
          recommendation && (
            <section
              aria-labelledby="decide-result-heading"
              className="flex flex-col gap-4 rounded-lg border border-accent/50 bg-surface p-5 sm:p-6"
            >
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
                  {OUTCOME_TAG[recommendation.outcome]}
                </span>
                <h2 id="decide-result-heading" className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
                  {recommendation.title}
                </h2>
              </div>

              <p className="max-w-prose text-text">{recommendation.rationale}</p>

              <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
                <p className="flex flex-col gap-1 text-sm text-text-muted">
                  <span className="font-semibold text-text">The cost / energy tradeoff</span>
                  {recommendation.tradeoff}
                </p>
              </div>

              {/* Front-door CTA: push the user into the live comparison, don't dead-end. */}
              <div className="flex flex-col gap-2 rounded-lg border border-accent/50 bg-surface-2 p-4">
                <p className="text-sm text-text-muted">
                  Don&apos;t take our word for it — run the numbers on the demo corpus and watch the
                  latency, cost, and accuracy tradeoff play out.
                </p>
                <Link
                  href="/benchmark"
                  className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-accent px-5 font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  {OUTCOME_CTA[recommendation.outcome]} →
                </Link>
              </div>

              {/* Transparent reasoning */}
              <details className="rounded-lg border border-border bg-surface-2 px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-text">
                  Why this answer?
                </summary>
                <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm text-text-muted">
                  {recommendation.signals.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-text-muted">
                  The logic is a fixed decision tree — same answers always give the same result.{" "}
                  <a
                    href="https://github.com/Raxorr/ragornot/blob/main/src/lib/decide-logic.ts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-accent-text"
                  >
                    Read the source
                  </a>
                  .
                </p>
              </details>

              {/* Share / act */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2"
                >
                  {copied === "link" ? "Link copied ✓" : "Copy shareable link"}
                </button>
                <button
                  type="button"
                  onClick={() => void copyText()}
                  className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2"
                >
                  {copied === "text" ? "Summary copied ✓" : "Copy summary"}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-text-muted transition-colors hover:text-text"
                >
                  Start over
                </button>
              </div>

              <p className="text-xs text-text-muted">
                Every cost/energy figure above comes from the same cited coefficients as the rest of the site.{" "}
                <Link href="/methodology" className="underline hover:text-accent-text">
                  See how they&apos;re derived
                </Link>
                . These are order-of-magnitude estimates, not measurements.
              </p>

              {/* Shareable branded card */}
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-text">Share this result</h3>
                <ShareCard
                  data={{
                    eyebrow: "RAG or not?",
                    headline: recommendation.title,
                    stats: OUTCOME_STATS[recommendation.outcome],
                    note: "Order-of-magnitude estimates",
                  }}
                  fileName="ragornot-decision"
                  shareText={`"RAG or not?" for my use case: ${recommendation.title}. Decide yours:`}
                  shareUrl={`${absoluteUrl("/decide")}${encodeAnswers(answers) ? `#${encodeAnswers(answers)}` : ""}`}
                />
              </div>
            </section>
          )
        )}
      </div>
    </div>
  );
}
