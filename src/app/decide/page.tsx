import type { Metadata } from "next";
import Link from "next/link";
import DecideTool from "@/components/decide/DecideTool";
import { absoluteUrl } from "@/lib/site-url";
import { DECIDE_FAQ, DECIDE_LOGIC_PROSE } from "@/lib/decide-faq";

export const metadata: Metadata = {
  title: "Do I Need RAG? Decision Tool",
  description:
    "Should you use RAG, lexical search, long-context, or fine-tuning? Decide in under a minute, with real cost and energy tradeoffs — plus a live benchmark of retrieval modes.",
  alternates: { canonical: absoluteUrl("/decide") },
};

// FAQPage + WebApplication structured data. Built from the same source as the
// visible FAQ so it stays valid and truthful.
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: DECIDE_FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

const APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ragornot — Do I Need RAG? Decision Tool",
  url: absoluteUrl("/decide"),
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description:
    "An interactive decision tool that recommends RAG, lexical (BM25) search, long-context, fine-tuning, or no AI at all — each with the real cost and energy tradeoff — backed by a live benchmark of retrieval modes over AWS documentation.",
  author: { "@type": "Person", name: "Rohit Sarna", url: "https://github.com/Raxorr" },
};

export default function DecidePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_JSON_LD) }}
      />

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
          RAG. Curious how the options compare live? Run the{" "}
          <Link href="/benchmark" className="underline hover:text-accent-text">Benchmark</Link>.
        </p>
      </header>

      <DecideTool />

      {/* Crawlable prose answer — LLMs and search crawlers read text, not the
          interactive widget's state, so the actual answer lives here in the HTML. */}
      <section aria-labelledby="answer-heading" className="flex flex-col gap-4 border-t border-border pt-10">
        <h2 id="answer-heading" className="text-2xl font-bold tracking-tight text-text">
          Do I need RAG? The short answer
        </h2>
        <p className="max-w-prose text-text-muted">
          RAG (retrieval-augmented generation) is worth it when your answers must reflect{" "}
          <span className="text-text">private, current, or large and changing data</span> and you need
          to <span className="text-text">cite sources</span>. It isn&apos;t always the right tool: if the
          relevant knowledge fits in a prompt and rarely changes, long-context or a good system prompt
          can be enough; if you just need to find a document, lexical (BM25) search is cheaper and
          faster; and if you need exact lookups of structured records, a database beats an LLM.
        </p>
        <p className="max-w-prose text-text-muted">{DECIDE_LOGIC_PROSE}</p>
        <p className="max-w-prose text-sm text-text-muted">
          The cost and energy figures behind these tradeoffs are sourced on the{" "}
          <Link href="/methodology" className="underline hover:text-accent-text">methodology</Link>{" "}
          page, and you can see the modes compared live on the{" "}
          <Link href="/benchmark" className="underline hover:text-accent-text">benchmark</Link>.
        </p>
      </section>

      {/* Visible FAQ — same Q&A as the FAQPage JSON-LD above. */}
      <section aria-labelledby="faq-heading" className="flex flex-col gap-6">
        <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-text">
          RAG or not — FAQ
        </h2>
        <dl className="flex flex-col gap-6">
          {DECIDE_FAQ.map((item) => (
            <div key={item.q} className="flex flex-col gap-2">
              <dt className="text-base font-semibold text-text">{item.q}</dt>
              <dd className="max-w-prose text-text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
