// Central feature flags.
//
// The `features/impact-community` branch adds five features (impact calculator,
// /decide, session meter, share cards, /digest). Anything that MODIFIES an
// existing rendered surface (the Benchmark tab, global page chrome) is gated
// here and defaults to `false`, so merging this branch to `main` can never
// regress the live site until the owner deliberately flips it on. Purely
// additive new routes default `true` — they can't affect existing tabs.
//
// To preview everything locally: set the `false` flags below to `true`, run
// `npm run dev`. To ship a feature: flip its flag to `true` and commit.

export const flags = {
  // ── Additive new routes (safe: cannot affect existing tabs) ────────────────
  /** /methodology page + the "How we calculate this" link from the impact section. */
  methodologyPage: true,
  /** /decide interactive "RAG or not?" tool + its nav entry. */
  decideTool: true,
  /** /digest "RAG Reality Check" page + its nav entry. */
  digestPage: true,

  // ── In-place modifications to existing surfaces (default OFF — owner opts in) ─
  /**
   * Impact Analytics v2 on the Benchmark tab: replaces the existing illustrative
   * impact section with the sourced, coefficient-linked version. OFF keeps the
   * Benchmark tab byte-identical to today.
   */
  impactV2: false,
  /**
   * Session self-consumption meter: a small floating widget that accumulates
   * estimated energy/water from real Benchmark/Explore runs this session.
   * OFF removes the widget entirely (recording is a harmless no-op).
   */
  sessionMeter: false,
  /**
   * "Share this result" card on the Benchmark results. The /decide share card
   * is always available (it lives on a new route); this flag only gates the
   * share UI added to the existing Benchmark tab.
   */
  shareCards: false,
} as const;

export type FeatureFlag = keyof typeof flags;
