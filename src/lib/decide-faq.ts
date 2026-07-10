// Shared source for the /decide crawlable answer, the visible FAQ, and the
// FAQPage JSON-LD — one place so the prose and structured data never drift and
// stay truthful. Answers mirror the decision logic in decide-logic.ts and quote
// the cited figures from impact-data.ts.

export interface FaqItem {
  q: string;
  a: string;
}

export const DECIDE_FAQ: FaqItem[] = [
  {
    q: "Do I need RAG?",
    a: "Use RAG when your answers must reflect private, current, or large/changing data and you need to cite sources. If your knowledge is small and rarely changes, long-context (pasting it into the prompt) or a good system prompt can be enough. If you only need to find the right document, lexical (BM25) search is cheaper and faster. If you need exact lookups of structured records, use a database — not an LLM.",
  },
  {
    q: "RAG vs long-context — which is cheaper?",
    a: "Retrieval is far cheaper. Stuffing a long document into the context window costs roughly 20–24× more than RAG and about 100× the energy (~40 Wh vs ~0.3 Wh per query), because you pay for those tokens on every call. Long-context is fine at small scale; switch to RAG as your documents or query volume grow.",
  },
  {
    q: "RAG vs fine-tuning — when should I fine-tune?",
    a: "Fine-tuning adapts a model's style, format, or task behavior and can shrink prompts at high volume, but it doesn't cite sources and must be redone whenever your data changes. For fresh, citable knowledge, RAG stays current without retraining. Reach for fine-tuning only for a small, stable, high-volume workload that doesn't need citations.",
  },
  {
    q: "When is RAG not worth it?",
    a: "When your knowledge fits in a prompt and rarely changes (use long-context), when you just need to locate a passage (use lexical search), when you need exact structured lookups (use a database), or when you don't actually need generated answers at all. RAG adds a retrieval system and a per-query LLM cost — worth it only when grounding on your own, changing data is the point.",
  },
];

// The decision tree, written out as prose so crawlers and LLMs — which read
// text, not interactive widget state — get the actual answer.
export const DECIDE_LOGIC_PROSE =
  "Answer honestly about your use case. If you need exact lookups of structured records (IDs, prices, rows), use a database — not AI. If you need to find the right document or passage, use lexical (BM25) search. If you need generated natural-language answers: choose RAG when the knowledge is private, current, large, or changing, or when you need citations; consider fine-tuning — or a strong system prompt — for a small, stable, high-volume workload that doesn't need citations; and long-context is fine when everything relevant fits in a prompt, rarely changes, and volume is low.";
