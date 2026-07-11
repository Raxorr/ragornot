import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site-url";
import {
  ENERGY,
  WATER,
  WATER_GLOBAL_2025,
  GRID_OPTIONS,
  GRID_INTENSITY_SOURCE,
  RAG_VS_LONGCONTEXT,
  EQUIVALENTS,
  ALL_SOURCED_FIGURES,
  TYPICAL_SHORT_QUERY_TOKENS,
  ENERGY_WH_PER_1K_TOKENS,
  ENERGY_UNCERTAINTY,
  PUE_OPTIONS,
  PUE_SOURCE,
  BASELINE_PUE,
  type SourcedFigure,
} from "@/lib/impact-data";
import EnergyContrast from "@/components/impact/EnergyContrast";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Exactly how ragornot estimates energy, water, and CO₂ per query — every coefficient, its source, the formulas, scope-1 vs full-scope water, and the honest caveats behind the impact numbers.",
  alternates: { canonical: absoluteUrl("/methodology") },
};

function FigureRow({ figure }: { figure: SourcedFigure }) {
  return (
    <tr className="border-b border-border last:border-b-0 align-top">
      <th scope="row" className="px-3 py-3 text-left font-medium text-text">
        {figure.label}
        {figure.scope && <span className="block text-xs font-normal text-text-muted">{figure.scope}</span>}
      </th>
      <td className="px-3 py-3 font-mono text-text whitespace-nowrap">
        {figure.range ? `${figure.range[0]}–${figure.range[1]}` : figure.value} {figure.unit}
      </td>
      <td className="px-3 py-3 text-text-muted">
        {figure.note}
      </td>
      <td className="px-3 py-3">
        <a
          href={figure.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-text underline decoration-dotted underline-offset-2 hover:text-accent"
        >
          {figure.source}
        </a>
      </td>
    </tr>
  );
}

function FigureTable({ figures }: { figures: SourcedFigure[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            <th scope="col" className="px-3 py-2 font-semibold text-text">Figure</th>
            <th scope="col" className="px-3 py-2 font-semibold text-text">Value</th>
            <th scope="col" className="px-3 py-2 font-semibold text-text">What it means</th>
            <th scope="col" className="px-3 py-2 font-semibold text-text">Source</th>
          </tr>
        </thead>
        <tbody>
          {figures.map((f) => (
            <FigureRow key={f.label} figure={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          How we calculate this
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">Methodology</h1>
        <p className="max-w-prose text-lg text-text-muted">
          Every environmental number on ragornot — in the{" "}
          <Link href="/benchmark" className="underline hover:text-accent-text">Benchmark</Link> impact
          section, the <Link href="/decide" className="underline hover:text-accent-text">decision tool</Link>,
          and the <Link href="/digest" className="underline hover:text-accent-text">digest</Link> — comes from
          the cited coefficients below. This page is the whole recipe: the figures, their sources, the
          formulas, and the caveats.
        </p>
      </header>

      {/* The honesty caveat — front and centre, not buried */}
      <section
        aria-labelledby="caveat-heading"
        className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface-2 p-5 sm:p-6"
      >
        <h2 id="caveat-heading" className="text-lg font-bold text-text">
          Read this first: these are estimates, not measurements
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-text-muted">
          <li>
            Every derived figure is an <strong className="text-text">order-of-magnitude estimate</strong>. It
            tells you the shape of a tradeoff, not a certified measurement.
          </li>
          <li>
            <strong className="text-text">ragornot itself runs Claude Haiku on Amazon Bedrock over a small
            demo corpus.</strong> The frontier-model energy and water figures below are{" "}
            <strong className="text-text">literature-derived proxies applied to the modes</strong> — they are
            not direct measurements of ragornot&apos;s own Bedrock calls. We use published figures because
            they&apos;re the most defensible numbers available, and we&apos;d rather show them honestly than
            invent our own.
          </li>
          <li>
            Water is always split into <strong className="text-text">scope-1</strong> (on-site cooling only)
            and <strong className="text-text">full-scope</strong> (including the water used to generate the
            electricity). We never conflate the two.
          </li>
          <li>
            No cross-user averages. Anything session-based (the{" "}
            <Link href="/benchmark" className="underline hover:text-accent-text">self-consumption meter</Link>)
            is labelled as a this-session estimate that resets on refresh.
          </li>
        </ul>
      </section>

      {/* Measured vs modeled */}
      <section aria-labelledby="mvm-heading" className="flex flex-col gap-4">
        <h2 id="mvm-heading" className="text-2xl font-bold tracking-tight text-text">Measured vs modeled</h2>
        <p className="max-w-prose text-sm text-text-muted">
          Two very different kinds of number appear on the benchmark, and we badge each one so you never
          confuse them:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-text-muted">
          <li>
            <strong className="text-text">Measured</strong> — latency, token counts, and cost per query come
            straight from the Amazon Bedrock API response (token billing). These are real numbers from your run.
          </li>
          <li>
            <strong className="text-text">Modeled</strong> — energy, water, and CO₂ are computed from the
            literature coefficients below. They are order-of-magnitude estimates, not measurements, and are
            tagged &ldquo;modeled — estimate&rdquo; wherever they appear.
          </li>
        </ul>
        <p className="max-w-prose text-sm text-text-muted">
          <strong className="text-text">Retrieval relevance is a proxy, not answer correctness.</strong> The
          &ldquo;Relevance %&rdquo; column is a BM25 / query-term retrieval-confidence score — how lexically
          relevant the retrieved chunks are — <em>not</em> whether the final answer is correct. End-answer
          evaluation (correctness, faithfulness, citation quality) against a golden set is a planned future
          metric. LLM-only has no retrieval step, so it shows N/A.
        </p>
      </section>

      {/* Flagship contrast */}
      <EnergyContrast />

      {/* Energy */}
      <section aria-labelledby="energy-heading" className="flex flex-col gap-4">
        <h2 id="energy-heading" className="text-2xl font-bold tracking-tight text-text">Energy per query</h2>
        <p className="max-w-prose text-sm text-text-muted">
          Electricity per query for modern models, from Epoch AI&apos;s analysis. A short chat query is the
          baseline a retrieval-grounded answer looks like; long-context stuffing is the expensive alternative.
        </p>
        <FigureTable figures={[ENERGY.chatShort, ENERGY.reasoning, ENERGY.longContext]} />
      </section>

      {/* Water */}
      <section aria-labelledby="water-heading" className="flex flex-col gap-4">
        <h2 id="water-heading" className="text-2xl font-bold tracking-tight text-text">Water per query</h2>
        <p className="max-w-prose text-sm text-text-muted">
          <strong className="text-text">Scope-1</strong> counts only the water evaporated by on-site
          data-center cooling — the figure vendors disclose. <strong className="text-text">Full-scope</strong>{" "}
          adds the water consumed generating the electricity, which is roughly 4× larger. The Benchmark charts
          show full-scope and say so; here are both.
        </p>
        <FigureTable figures={[WATER.scope1OpenAI, WATER.scope1Gemini, WATER.fullScopeGpt4o, WATER_GLOBAL_2025]} />
      </section>

      {/* Carbon */}
      <section aria-labelledby="carbon-heading" className="flex flex-col gap-4">
        <h2 id="carbon-heading" className="text-2xl font-bold tracking-tight text-text">Carbon</h2>
        <p className="max-w-prose text-sm text-text-muted">
          Carbon is computed from energy and the carbon intensity of the grid, which you can change in the
          Benchmark impact section. The assumption is always shown, never buried.
        </p>
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 font-mono text-sm text-text">
          gCO₂ = energy(kWh) × grid intensity (gCO₂/kWh)
        </div>
        <FigureTable figures={[GRID_INTENSITY_SOURCE]} />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th scope="col" className="px-3 py-2 font-semibold text-text">Grid preset</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">gCO₂/kWh</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Note</th>
              </tr>
            </thead>
            <tbody>
              {GRID_OPTIONS.map((g) => (
                <tr key={g.id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-3 py-3 text-left font-medium text-text">{g.label}</th>
                  <td className="px-3 py-3 font-mono text-text">{g.gPerKwh}</td>
                  <td className="px-3 py-3 text-text-muted">{g.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* RAG vs long context */}
      <section aria-labelledby="ragvlc-heading" className="flex flex-col gap-4">
        <h2 id="ragvlc-heading" className="text-2xl font-bold tracking-tight text-text">
          RAG vs long-context (cost &amp; tokens)
        </h2>
        <p className="max-w-prose text-sm text-text-muted">
          The energy contrast has a cost twin: stuffing documents into every prompt bills for those tokens on
          every call, while retrieval pays only for the slice it fetches.
        </p>
        <FigureTable figures={[RAG_VS_LONGCONTEXT.costMultiplier, RAG_VS_LONGCONTEXT.tokenSavings]} />
      </section>

      {/* Formulas */}
      <section aria-labelledby="formulas-heading" className="flex flex-col gap-4">
        <h2 id="formulas-heading" className="text-2xl font-bold tracking-tight text-text">The exact formulas</h2>
        <p className="max-w-prose text-sm text-text-muted">
          We translate a query&apos;s <strong className="text-text">token count</strong> into energy — more
          defensible than deriving from dollar cost — anchored to the Epoch short-query figure. Water and CO₂
          then follow from that energy, so every number moves together.
        </p>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 px-4 py-4 font-mono text-xs text-text sm:text-sm">
          <p># anchor: a typical short query ≈ {TYPICAL_SHORT_QUERY_TOKENS} tokens ≈ {ENERGY.chatShort.value} Wh</p>
          <p>energy_Wh_per_1k_tokens = {ENERGY.chatShort.value} / ({TYPICAL_SHORT_QUERY_TOKENS} / 1000) = {ENERGY_WH_PER_1K_TOKENS} Wh</p>
          <p>energy_Wh    = (total_tokens / 1000) × {ENERGY_WH_PER_1K_TOKENS}</p>
          <p>effective_Wh = energy_Wh × (PUE / {BASELINE_PUE})       # PUE overhead, default {BASELINE_PUE}</p>
          <p>co2_g        = (effective_Wh / 1000) × grid_gCO2_per_kWh</p>
          <p>water_full   = (effective_Wh / {ENERGY.chatShort.value}) × {WATER.fullScopeGpt4o.value} mL   # full-scope</p>
          <p>water_scope1 = (effective_Wh / {ENERGY.chatShort.value}) × {WATER.scope1OpenAI.value} mL  # on-site cooling</p>
          <p># uncertainty band: scale effective_Wh by {ENERGY_UNCERTAINTY.lowRatio.toFixed(2)}× (low) to {ENERGY_UNCERTAINTY.highRatio.toFixed(2)}× (high)</p>
          <p className="text-text-muted"># from Epoch&apos;s {ENERGY_UNCERTAINTY.lowWh}–{ENERGY_UNCERTAINTY.highWh} Wh short-query range around the {ENERGY_UNCERTAINTY.midWh} Wh mid</p>
          <p className="text-text-muted"># Flat / Hierarchical make no LLM call → ~0 marginal energy, water, CO₂</p>
          <p className="text-text-muted"># Live LLM/RAG runs derive energy from the run&apos;s own token count, same anchor</p>
        </div>
      </section>

      {/* Uncertainty & sensitivity */}
      <section aria-labelledby="uncertainty-heading" className="flex flex-col gap-4">
        <h2 id="uncertainty-heading" className="text-2xl font-bold tracking-tight text-text">
          Uncertainty &amp; sensitivity
        </h2>
        <p className="max-w-prose text-sm text-text-muted">
          Modeled figures are shown as <span className="font-mono text-text">mid (low–high)</span>, never a
          single false-precision point. The energy band comes from Epoch AI&apos;s short-query range
          ({ENERGY_UNCERTAINTY.lowWh}–{ENERGY_UNCERTAINTY.highWh} Wh around the {ENERGY_UNCERTAINTY.midWh} Wh mid);
          CO₂ and water inherit that band. Other ranged coefficients: full-scope water
          {" "}{WATER.fullScopeGpt4o.range ? `${WATER.fullScopeGpt4o.range[0]}–${WATER.fullScopeGpt4o.range[1]} mL` : ""},
          grid intensity {GRID_INTENSITY_SOURCE.range ? `${GRID_INTENSITY_SOURCE.range[0]}–${GRID_INTENSITY_SOURCE.range[1]} gCO₂/kWh` : ""},
          long-context cost {RAG_VS_LONGCONTEXT.costMultiplier.range ? `${RAG_VS_LONGCONTEXT.costMultiplier.range[0]}–${RAG_VS_LONGCONTEXT.costMultiplier.range[1]}×` : ""},
          and RAG token savings {RAG_VS_LONGCONTEXT.tokenSavings.range ? `${RAG_VS_LONGCONTEXT.tokenSavings.range[0]}–${RAG_VS_LONGCONTEXT.tokenSavings.range[1]}×` : ""} —
          each traced to its source in the tables above.
        </p>
        <p className="max-w-prose text-sm text-text-muted">
          The Benchmark impact panel exposes three <strong className="text-text">sensitivity controls</strong> —
          grid intensity, PUE (data-center overhead), and per-token energy (efficient / typical / conservative,
          mapping to the low / mid / high energy) — and every modeled figure recomputes live as you change them.
        </p>
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 font-mono text-sm text-text">
          effective_energy = token→Wh × (PUE / {BASELINE_PUE})
        </div>
        <FigureTable figures={[PUE_SOURCE]} />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th scope="col" className="px-3 py-2 font-semibold text-text">PUE preset</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Value</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Note</th>
              </tr>
            </thead>
            <tbody>
              {PUE_OPTIONS.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-3 py-3 text-left font-medium text-text">{p.label}</th>
                  <td className="px-3 py-3 font-mono text-text">{p.value}×</td>
                  <td className="px-3 py-3 text-text-muted">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Statistical limitations */}
      <section aria-labelledby="stats-heading" className="flex flex-col gap-4">
        <h2 id="stats-heading" className="text-2xl font-bold tracking-tight text-text">Statistical limitations</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-text-muted">
          <li>
            A standard run is <strong className="text-text">n = 7 queries</strong>. The Step 2 aggregate reports
            min / median / max / standard deviation per mode — <strong className="text-text">descriptive
            statistics only</strong>, not a statistically powered comparison.
          </li>
          <li>
            There is no significance testing and no golden set. A 50–100 question benchmark with{" "}
            <strong className="text-text">expected sources</strong> (to score answer correctness and citation
            quality, not just retrieval relevance) is the planned next step.
          </li>
          <li>
            Relevance is a lexical retrieval proxy, not answer correctness (see &ldquo;Measured vs modeled&rdquo;).
          </li>
        </ul>
      </section>

      {/* Everyday equivalents */}
      <section aria-labelledby="equiv-heading" className="flex flex-col gap-4">
        <h2 id="equiv-heading" className="text-2xl font-bold tracking-tight text-text">Everyday equivalents</h2>
        <p className="max-w-prose text-sm text-text-muted">
          The car-km and phone-charge comparisons are rough conversion factors for intuition only — not a claim
          about any specific vehicle or phone.
        </p>
        <FigureTable figures={[EQUIVALENTS.carGPerKm, EQUIVALENTS.phoneChargeG]} />
      </section>

      {/* Full citation list */}
      <section aria-labelledby="sources-heading" className="flex flex-col gap-4">
        <h2 id="sources-heading" className="text-2xl font-bold tracking-tight text-text">All sources</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-text-muted">
          {ALL_SOURCED_FIGURES.map((f) => (
            <li key={f.label}>
              <span className="text-text">{f.label}</span> —{" "}
              <a
                href={f.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text underline decoration-dotted underline-offset-2 hover:text-accent"
              >
                {f.source}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-text-muted">
          Spotted an error or a better source? ragornot is open source —{" "}
          <a
            href="https://github.com/Raxorr/ragornot"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent-text"
          >
            open an issue
          </a>
          .
        </p>
      </section>
    </div>
  );
}
