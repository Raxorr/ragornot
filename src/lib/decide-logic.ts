// Deterministic, transparent decision logic for the /decide "RAG or not?" tool.
// Pure functions only — no backend, no randomness. The reasoning trace
// (`signals`) is returned alongside the recommendation so the UI can show
// exactly *why* it landed where it did.
//
// Tradeoff sentences quote the ground-truth figures from impact-data so the
// numbers stay consistent with the rest of the site.

import { ENERGY, WATER, RAG_VS_LONGCONTEXT } from "./impact-data";

const COST_X = `${RAG_VS_LONGCONTEXT.costMultiplier.range?.[0]}–${RAG_VS_LONGCONTEXT.costMultiplier.range?.[1]}×`; // 20–24×
const RETRIEVAL_WH = ENERGY.chatShort.value; // 0.3
const LONGCTX_WH = ENERGY.longContext.value; // 40
const FULLSCOPE_WATER = WATER.fullScopeGpt4o.value; // 1.2 mL

export interface DecideOption {
  value: string;
  label: string;
}

export interface DecideQuestion {
  /** Short, URL-safe key. */
  id: string;
  question: string;
  help?: string;
  options: DecideOption[];
}

export const QUESTIONS: DecideQuestion[] = [
  {
    id: "need",
    question: "What do you actually need out of this?",
    help: "Be honest about the end goal — it's the biggest fork in the road.",
    options: [
      { value: "answers", label: "Generated natural-language answers" },
      { value: "find", label: "Just find the right document or passage" },
      { value: "lookup", label: "Exact lookup of structured records (IDs, prices, rows)" },
    ],
  },
  {
    id: "data",
    question: "Does answering require private, proprietary, or frequently-updated data the model wasn't trained on?",
    options: [
      { value: "yes", label: "Yes — private and/or current data" },
      { value: "no", label: "No — general knowledge is enough" },
    ],
  },
  {
    id: "cite",
    question: "Do you need citations or verifiable grounding?",
    help: "i.e. users must be able to trace an answer back to a source.",
    options: [
      { value: "yes", label: "Yes — answers must cite sources" },
      { value: "no", label: "No — grounding isn't required" },
    ],
  },
  {
    id: "size",
    question: "How much reference material is relevant to a typical question?",
    options: [
      { value: "small", label: "A few pages — it fits in a prompt" },
      { value: "large", label: "Many docs / a large corpus" },
    ],
  },
  {
    id: "churn",
    question: "How often does that reference material change?",
    options: [
      { value: "stable", label: "Rarely — mostly stable" },
      { value: "changes", label: "Often — new or updated content regularly" },
    ],
  },
  {
    id: "lat",
    question: "Is very low latency (sub-second) critical?",
    options: [
      { value: "yes", label: "Yes — speed is critical" },
      { value: "no", label: "No — a second or so is fine" },
    ],
  },
  {
    id: "cost",
    question: "Is cost-per-query tightly constrained?",
    help: "High volume, thin margins, or a hard budget per request.",
    options: [
      { value: "yes", label: "Yes — every query's cost matters" },
      { value: "no", label: "No — cost isn't the binding constraint" },
    ],
  },
  {
    id: "scale",
    question: "Roughly how many queries per day?",
    options: [
      { value: "low", label: "Under ~100" },
      { value: "med", label: "~100 – 10,000" },
      { value: "high", label: "Over ~10,000" },
    ],
  },
];

export type Outcome = "rag" | "lexical" | "long-context" | "fine-tuning" | "none";
export type Answers = Record<string, string>;

export interface Recommendation {
  outcome: Outcome;
  /** Headline, e.g. "Use RAG". */
  title: string;
  /** 2–3 sentence plain-English rationale. */
  rationale: string;
  /** The cost/energy tradeoff, quoting ground-truth figures. */
  tradeoff: string;
  /** Transparent "why this answer" trace — the signals that decided it. */
  signals: string[];
}

/** True once every question has an answer. */
export function isComplete(a: Answers): boolean {
  return QUESTIONS.every((q) => Boolean(a[q.id]));
}

/**
 * The decision tree. Deterministic and total: given complete answers it always
 * returns one of five recommendations. Returns null while answers are partial.
 */
export function decide(a: Answers): Recommendation | null {
  if (!isComplete(a)) return null;

  const signals: string[] = [];
  const latencyCaveat =
    a.lat === "yes"
      ? "You flagged latency as critical — generative modes add ~0.7–0.9s per query, vs single-digit-millisecond lexical retrieval. Keep that in the budget."
      : null;

  // 1. Not a generation problem at all.
  if (a.need === "lookup") {
    signals.push("You need exact lookups over structured records — that's a database/search-index job, not a language model.");
    return {
      outcome: "none",
      title: "You probably don't need AI here",
      rationale:
        "This looks like exact lookup over structured records (IDs, prices, rows). A database query or a plain search index does it faster, cheaper, and exactly — with zero hallucination risk. Reach for SQL or a keyword index before an LLM.",
      tradeoff: `You avoid a generative call entirely — roughly ${RETRIEVAL_WH} Wh and ~${FULLSCOPE_WATER} mL of full-scope water saved on every request, versus an LLM you didn't need.`,
      signals,
    };
  }

  // 2. Finding a passage, not generating prose.
  if (a.need === "find") {
    signals.push("You want to locate the right passage, not generate an answer — retrieval returns the source directly.");
    if (a.data === "yes") signals.push("Your data is private/current, so search your own index rather than a trained-in model.");
    return {
      outcome: "lexical",
      title: "Use lexical (BM25) search",
      rationale:
        "You need to find the right document or passage, not synthesize prose. Keyword/BM25 search — optionally hybrid with vector search — returns the source directly. No LLM call, no hallucination, no per-query generation cost. Add a generative layer later only if users start asking for synthesized answers.",
      tradeoff: `Near-zero energy, water, and cost per query at single-digit-millisecond latency. You skip the generative call entirely — about ${RETRIEVAL_WH} Wh and ~${FULLSCOPE_WATER} mL of full-scope water saved per query versus an LLM answer.`,
      signals,
    };
  }

  // From here: a.need === "answers" — generation is genuinely wanted.
  const needsRetrieval =
    a.data === "yes" || a.cite === "yes" || a.churn === "changes" || a.size === "large";

  if (needsRetrieval) {
    if (a.data === "yes") signals.push("Answers depend on private or current data → retrieval keeps them fresh without retraining.");
    if (a.cite === "yes") signals.push("You need citations → retrieval gives you a source to point at for every claim.");
    if (a.churn === "changes") signals.push("Your content changes often → RAG picks up updates the moment they're indexed.");
    if (a.size === "large") signals.push("The corpus is large → it can't fit in a prompt, so you must retrieve the relevant slice.");
    if (latencyCaveat) signals.push(latencyCaveat);
    return {
      outcome: "rag",
      title: "Use RAG",
      rationale:
        "Retrieval-augmented generation fetches the relevant slice of your data at query time and generates a grounded answer you can cite. It's the right default when answers must reflect private, current, or large/changing knowledge and users need to trust the source.",
      tradeoff: `RAG costs a little more than lexical search (one Bedrock call per query) but is roughly ${COST_X} cheaper than stuffing everything into context, and keeps energy near the ~${RETRIEVAL_WH} Wh short-query budget instead of the ~${LONGCTX_WH} Wh long-context tax — about 100× less energy.`,
      signals,
    };
  }

  // Small, stable, general, ungrounded knowledge.
  signals.push("Your knowledge is small, stable, general, and doesn't need citations — no retrieval system required.");
  if (a.scale === "high" || a.cost === "yes") {
    if (a.scale === "high") signals.push("At high volume, shrinking each prompt pays off — bake the behavior in instead of re-sending context every call.");
    if (a.cost === "yes") signals.push("Cost-per-query is constrained → smaller prompts cut token spend on every request.");
    if (latencyCaveat) signals.push(latencyCaveat);
    return {
      outcome: "fine-tuning",
      title: "Consider fine-tuning (or a strong system prompt)",
      rationale:
        "For a small, stable knowledge base at high volume where you don't need citations, fine-tuning — or even a well-crafted system prompt — can bake in the behavior and shrink every prompt, cutting per-query tokens and cost. Try the system prompt first; fine-tune only if that isn't enough.",
      tradeoff: `Fine-tuning doesn't cite sources and must be redone whenever the content changes. If your data starts updating or you need grounding, switch to RAG — retrieval stays current without retraining, and still beats long-context by roughly ${COST_X} on cost.`,
      signals,
    };
  }

  signals.push("Low volume + small, stable docs → the simplest thing that works is to paste them into the context window.");
  if (latencyCaveat) signals.push(latencyCaveat);
  return {
    outcome: "long-context",
    title: "Long-context is fine — for now",
    rationale:
      "If all your reference material fits in a prompt, rarely changes, and your volume is low, you don't need a retrieval system yet. Paste the material into the context window and skip the extra infrastructure. Revisit when the docs grow or traffic climbs.",
    tradeoff: `This only holds at small scale: long-context runs about ${COST_X} the cost and ~100× the energy (~${LONGCTX_WH} Wh vs ~${RETRIEVAL_WH} Wh) of retrieval per query. The moment your docs grow or volume climbs, switch to RAG.`,
    signals,
  };
}

// ── URL encode/decode so a result is linkable/shareable ──────────────────────

/** Encode answers into a compact query string (stable key order). */
export function encodeAnswers(a: Answers): string {
  return QUESTIONS.filter((q) => a[q.id])
    .map((q) => `${q.id}=${encodeURIComponent(a[q.id])}`)
    .join("&");
}

/** Parse answers back out of a query/hash string, keeping only valid values. */
export function decodeAnswers(search: string): Answers {
  const params = new URLSearchParams(search.replace(/^[?#]/, ""));
  const out: Answers = {};
  for (const q of QUESTIONS) {
    const v = params.get(q.id);
    if (v && q.options.some((o) => o.value === v)) out[q.id] = v;
  }
  return out;
}
