// ─────────────────────────────────────────────────────────────────────────────
// Ground-truth environmental data — the SINGLE source of every number that
// appears in the impact calculator, the /methodology page, the /decide tool,
// and the /digest. Nothing environmental is hardcoded elsewhere; it all traces
// back to one of these cited constants or a value returned by the live API.
//
// HONESTY GUARDRAILS (see /methodology):
//   • Every derived figure is an ORDER-OF-MAGNITUDE ESTIMATE, not a measurement.
//   • Water is always labelled scope-1 (on-site cooling) vs full-scope
//     (incl. electricity generation) — the two are never conflated.
//   • ragornot itself runs Claude Haiku on Bedrock over a small demo corpus, so
//     these frontier-model figures are LITERATURE-DERIVED PROXIES applied to the
//     modes, not direct measurements of ragornot's own calls.
// ─────────────────────────────────────────────────────────────────────────────

export interface SourcedFigure {
  /** Human-readable label for the figure. */
  label: string;
  /** Central estimate, in `unit`. */
  value: number;
  unit: string;
  /** Optional low/high range where the source gives one. */
  range?: [number, number];
  /** Scope / methodology caveat, e.g. "scope-1 (on-site cooling only)". */
  scope?: string;
  /** Short citation, e.g. 'Epoch AI, "How much energy does ChatGPT use?" (Feb 2025)'. */
  source: string;
  /** Canonical URL for the source. */
  sourceUrl: string;
  /** Plain-English note on what the number means / how to read it. */
  note?: string;
}

// ── Energy per query (electricity) ───────────────────────────────────────────

const EPOCH_URL = "https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use";
const EPOCH_CITE = 'Epoch AI, "How much energy does ChatGPT use?" (Feb 2025)';

export const ENERGY: Record<"chatShort" | "reasoning" | "longContext", SourcedFigure> = {
  chatShort: {
    label: "Typical short chat query (GPT-4o-class)",
    value: 0.3,
    unit: "Wh",
    range: [0.1, 0.6],
    source: EPOCH_CITE,
    sourceUrl: EPOCH_URL,
    note: "Varies with response length. This is the baseline a retrieval-grounded answer looks like.",
  },
  reasoning: {
    label: "Reasoning-heavy query (o3-class)",
    value: 3.9,
    unit: "Wh",
    source: EPOCH_CITE,
    sourceUrl: EPOCH_URL,
    note: "Extended chain-of-thought / test-time compute pushes energy up ~10× over a short chat query.",
  },
  longContext: {
    label: "Long-context query (~100k-token document stuffed into context)",
    value: 40,
    unit: "Wh",
    source: EPOCH_CITE,
    sourceUrl: EPOCH_URL,
    note: "Attaching a large document to every query is the expensive alternative to retrieving only what's relevant.",
  },
};

/** The flagship contrast: retrieval (~0.3 Wh) vs long-context stuffing (~40 Wh). */
export const ENERGY_CONTRAST_MULTIPLIER = Math.round(ENERGY.longContext.value / ENERGY.chatShort.value); // ≈ 133 → we present as "~100×"

// ── Water per query ──────────────────────────────────────────────────────────

export const WATER: Record<"scope1OpenAI" | "scope1Gemini" | "fullScopeGpt4o", SourcedFigure> = {
  scope1OpenAI: {
    label: "OpenAI, per query — on-site cooling",
    value: 0.32,
    unit: "mL",
    scope: "scope-1 (on-site cooling only)",
    source: "OpenAI (vendor-disclosed)",
    sourceUrl: "https://blog.samaltman.com/the-gentle-singularity",
    note: "Water evaporated by data-center cooling for the compute — excludes water used to generate the electricity.",
  },
  scope1Gemini: {
    label: "Google Gemini, median per query — on-site cooling",
    value: 0.26,
    unit: "mL",
    scope: "scope-1 (on-site cooling only)",
    source: "Google (vendor-disclosed, median)",
    sourceUrl: "https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference",
    note: "Vendor median for a text prompt; on-site cooling only.",
  },
  fullScopeGpt4o: {
    label: "GPT-4o short query — full scope",
    value: 1.2,
    unit: "mL",
    range: [1.0, 1.3], // scope-1 vendor range [0.26, 0.32] mL scaled to full-scope (~4×)
    scope: "full-scope (incl. electricity generation)",
    source: 'Jegham et al., "How Hungry is AI?" (arXiv, May 2025)',
    sourceUrl: "https://arxiv.org/html/2505.09598v1",
    note: "Adds the water consumed generating the electricity to the on-site cooling water — roughly ~4× the scope-1 figure. Range from the scope-1 vendor spread (0.26–0.32 mL) scaled to full-scope.",
  },
};

/** Context stat: global AI water footprint reached this range in 2025. */
export const WATER_GLOBAL_2025: SourcedFigure = {
  label: "Estimated global AI water use, 2025",
  value: 500, // midpoint, billions of litres
  unit: "billion L",
  range: [312, 764],
  scope: "full-scope, global aggregate",
  source: "de Vries, Patterns (Dec 2025)",
  sourceUrl: "https://www.cell.com/patterns/home",
  note: "Data-center cooling is ~30–40% of a data center's energy draw.",
};

// ── Carbon ───────────────────────────────────────────────────────────────────

export interface GridOption {
  id: string;
  label: string;
  /** gCO₂ per kWh. */
  gPerKwh: number;
  note: string;
}

/** Selectable grid intensities. Default is US-ish 400; the assumption is always shown, never buried. */
export const GRID_OPTIONS: GridOption[] = [
  { id: "us", label: "US grid (default)", gPerKwh: 400, note: "Roughly the US average carbon intensity." },
  { id: "global", label: "Global average", gPerKwh: 480, note: "Global average is higher than the US." },
  { id: "eu", label: "EU average", gPerKwh: 250, note: "More renewables and nuclear than the US average." },
  { id: "lowcarbon", label: "Low-carbon region", gPerKwh: 50, note: "Hydro / nuclear-heavy grids (e.g. Nordics, Québec)." },
];

export const DEFAULT_GRID = GRID_OPTIONS[0];

export const GRID_INTENSITY_SOURCE: SourcedFigure = {
  label: "Grid carbon intensity (configurable)",
  value: 400,
  unit: "gCO₂/kWh",
  range: [50, 480],
  source: "Ember / IEA grid-intensity averages",
  sourceUrl: "https://ember-energy.org/data/electricity-data-explorer/",
  note: "CO₂ = energy(kWh) × grid intensity. The default is US-ish; the global average is higher (~480).",
};

// ── RAG vs long-context (cost / token efficiency) ────────────────────────────

export const RAG_VS_LONGCONTEXT = {
  costMultiplier: {
    label: "Long-context is this much more expensive than RAG",
    value: 22, // midpoint of 20–24×
    unit: "×",
    range: [20, 24],
    source: 'arXiv, "The Token Tax" (2026)',
    sourceUrl: "https://arxiv.org/pdf/2606.20898",
    note: "Stuffing documents into every prompt bills for those tokens on every call; RAG pays only for the retrieved slice.",
  } satisfies SourcedFigure,
  tokenSavings: {
    label: "RAG is this much cheaper in tokens for typical workloads",
    value: 20, // representative point inside the 8–82× range
    unit: "×",
    range: [8, 82],
    source: "RAG 2025 review (RAGFlow)",
    sourceUrl: "https://ragflow.io/blog/rag-review-2025-from-rag-to-context",
    note: "Range depends on corpus size and query pattern; retrieval keeps the prompt small.",
  } satisfies SourcedFigure,
} as const;

// ── Everyday equivalents (rough conversion factors for intuition only) ───────

export const EQUIVALENTS = {
  carGPerKm: {
    label: "Passenger car tailpipe emissions",
    value: 200,
    unit: "gCO₂/km",
    source: "EPA / EEA typical passenger-car average",
    sourceUrl: "https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle",
    note: "Rough conversion factor for intuition, not a claim about any specific vehicle.",
  } satisfies SourcedFigure,
  phoneChargeG: {
    label: "Smartphone full charge",
    value: 8,
    unit: "gCO₂",
    source: "EPA equivalencies (approx.)",
    sourceUrl: "https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator",
    note: "Rough conversion factor for intuition only.",
  } satisfies SourcedFigure,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Derivation model
//
// We translate a query's TOKEN count into energy (more defensible than deriving
// from dollar cost), anchored to the Epoch short-query figure. Water and CO₂ are
// then derived from that energy so every number moves together and stays
// traceable to a cited coefficient.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assumed token count of a "typical short query" — the anchor that lets us turn
 * Epoch's per-query energy figure into a per-token coefficient. Documented on
 * /methodology; changing it rescales token-derived energy linearly.
 */
export const TYPICAL_SHORT_QUERY_TOKENS = 500;

/** Wh per 1,000 tokens, derived so a TYPICAL_SHORT_QUERY_TOKENS query ≈ ENERGY.chatShort. */
export const ENERGY_WH_PER_1K_TOKENS =
  ENERGY.chatShort.value / (TYPICAL_SHORT_QUERY_TOKENS / 1000);

/** Retrieval-only (Flat/Hierarchical) marginal energy — in-Lambda BM25, no GPU. */
export const RETRIEVAL_ONLY_ENERGY_WH = {
  flat: 0.0006,
  hierarchical: 0.0009,
} as const;

/**
 * Energy (Wh) for an LLM/RAG query from its total token count, anchored to the
 * Epoch short-query figure. Falls back to ENERGY.chatShort when tokens are 0
 * (e.g. cost/tokens unavailable) so the panel always shows a literature proxy.
 */
export function energyWhFromTokens(totalTokens: number): number {
  if (!totalTokens || totalTokens <= 0) return ENERGY.chatShort.value;
  return (totalTokens / 1000) * ENERGY_WH_PER_1K_TOKENS;
}

/** CO₂ grams from energy (Wh) at a given grid intensity (gCO₂/kWh). */
export function co2GramsFromEnergy(energyWh: number, gridGPerKwh: number = DEFAULT_GRID.gPerKwh): number {
  return (energyWh / 1000) * gridGPerKwh;
}

// ── Uncertainty bands & sensitivity (Epoch low/mid/high, PUE) ─────────────────

export interface Band {
  low: number;
  mid: number;
  high: number;
}

/**
 * Low/high multipliers on a chatShort-anchored energy value, from Epoch AI's
 * short-query range [0.1, 0.6] Wh around the 0.3 Wh mid. Both endpoints trace to
 * the same Epoch source as the mid.
 */
export const ENERGY_UNCERTAINTY = {
  lowRatio: (ENERGY.chatShort.range?.[0] ?? ENERGY.chatShort.value) / ENERGY.chatShort.value, // 0.1/0.3
  highRatio: (ENERGY.chatShort.range?.[1] ?? ENERGY.chatShort.value) / ENERGY.chatShort.value, // 0.6/0.3
  lowWh: ENERGY.chatShort.range?.[0] ?? ENERGY.chatShort.value, // 0.1
  midWh: ENERGY.chatShort.value, // 0.3
  highWh: ENERGY.chatShort.range?.[1] ?? ENERGY.chatShort.value, // 0.6
};

/** Uncertainty band around a token-derived (chatShort-anchored) energy value. */
export function energyBand(midWh: number): Band {
  return {
    low: midWh * ENERGY_UNCERTAINTY.lowRatio,
    mid: midWh,
    high: midWh * ENERGY_UNCERTAINTY.highRatio,
  };
}

/** Token-derived energy with a low/mid/high band from Epoch's short-query range. */
export function energyWhFromTokensRange(totalTokens: number): Band {
  return energyBand(energyWhFromTokens(totalTokens));
}

/** Per-token energy assumption (efficient / typical / conservative) → low/mid/high. */
export interface EnergyAssumption {
  id: "efficient" | "typical" | "conservative";
  label: string;
  /** Multiplier on the chatShort-anchored mid. */
  ratio: number;
  /** The implied Wh per short query. */
  wh: number;
}

export const ENERGY_ASSUMPTIONS: EnergyAssumption[] = [
  { id: "efficient", label: "Efficient", ratio: ENERGY_UNCERTAINTY.lowRatio, wh: ENERGY_UNCERTAINTY.lowWh },
  { id: "typical", label: "Typical", ratio: 1, wh: ENERGY_UNCERTAINTY.midWh },
  { id: "conservative", label: "Conservative", ratio: ENERGY_UNCERTAINTY.highRatio, wh: ENERGY_UNCERTAINTY.highWh },
];

export const DEFAULT_ENERGY_ASSUMPTION: EnergyAssumption["id"] = "typical";

/** PUE (Power Usage Effectiveness) — data-center overhead multiplier on IT energy. */
export interface PueOption {
  id: string;
  label: string;
  value: number;
  note: string;
}

/** The PUE assumed baked into the Epoch short-query figure (typical hyperscaler). */
export const BASELINE_PUE = 1.2;

export const PUE_OPTIONS: PueOption[] = [
  { id: "best", label: "Hyperscaler best", value: 1.1, note: "Best-in-class hyperscaler data center." },
  { id: "typical", label: "Typical hyperscaler", value: 1.2, note: "Typical hyperscaler — assumed in the base figure." },
  { id: "average", label: "Average data center", value: 1.4, note: "Average enterprise / colocation data center." },
  { id: "global", label: "Global average", value: 1.58, note: "Global data-center average." },
];

export const DEFAULT_PUE_ID = "typical";

export const PUE_SOURCE: SourcedFigure = {
  label: "Data-center PUE (Power Usage Effectiveness)",
  value: 1.2,
  unit: "×",
  range: [1.1, 1.58],
  source: "Uptime Institute Global Data Center Survey / IEA",
  sourceUrl: "https://uptimeinstitute.com/uptime_assets/6f7e2b3f4b1e6c1e-2024GlobalDataCenterSurvey.pdf",
  note: "Overhead multiplier on IT energy for cooling and power delivery. Effective energy = base × (PUE / baseline 1.2).",
};

/**
 * Water (mL) for a query, derived by scaling the chosen per-query water figure
 * with the energy ratio relative to the Epoch short-query baseline. Both scopes
 * are available; callers must label which one they show.
 */
export function waterMlFromEnergy(energyWh: number, scope: "scope1" | "fullScope"): number {
  const perQuery = scope === "fullScope" ? WATER.fullScopeGpt4o.value : WATER.scope1OpenAI.value;
  return (energyWh / ENERGY.chatShort.value) * perQuery;
}

// ── Formatters (kept here so every impact surface renders numbers identically) ─

export function formatEnergyWh(wh: number): string {
  if (wh > 0 && wh < 0.001) return "<0.001 Wh";
  if (wh < 1) return `${wh.toFixed(3)} Wh`;
  return `${wh.toFixed(1)} Wh`;
}

export function formatCo2Grams(g: number): string {
  if (g > 0 && g < 0.001) return "<0.001 g";
  if (g < 1) return `${g.toFixed(3)} g`;
  if (g < 1000) return `${g.toFixed(1)} g`;
  return `${(g / 1000).toFixed(2)} kg`;
}

export function formatWaterMl(ml: number): string {
  if (ml > 0 && ml < 0.01) return "<0.01 mL";
  if (ml < 1000) return `${ml.toFixed(2)} mL`;
  return `${(ml / 1000).toFixed(2)} L`;
}

/** Every SourcedFigure that has a distinct source, for the methodology page's citation list. */
export const ALL_SOURCED_FIGURES: SourcedFigure[] = [
  ENERGY.chatShort,
  ENERGY.reasoning,
  ENERGY.longContext,
  WATER.scope1OpenAI,
  WATER.scope1Gemini,
  WATER.fullScopeGpt4o,
  WATER_GLOBAL_2025,
  GRID_INTENSITY_SOURCE,
  PUE_SOURCE,
  RAG_VS_LONGCONTEXT.costMultiplier,
  RAG_VS_LONGCONTEXT.tokenSavings,
  EQUIVALENTS.carGPerKm,
  EQUIVALENTS.phoneChargeG,
];
