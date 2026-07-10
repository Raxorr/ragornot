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
          <p>energy_Wh   = (total_tokens / 1000) × {ENERGY_WH_PER_1K_TOKENS}</p>
          <p>co2_g       = (energy_Wh / 1000) × grid_gCO2_per_kWh</p>
          <p>water_full  = (energy_Wh / {ENERGY.chatShort.value}) × {WATER.fullScopeGpt4o.value} mL   # full-scope</p>
          <p>water_scope1= (energy_Wh / {ENERGY.chatShort.value}) × {WATER.scope1OpenAI.value} mL  # on-site cooling</p>
          <p className="text-text-muted"># Flat / Hierarchical make no LLM call → ~0 marginal energy, water, CO₂</p>
          <p className="text-text-muted"># Live LLM/RAG runs derive energy from the run&apos;s own token cost, same anchor</p>
        </div>
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
