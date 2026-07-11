# Prompt #1 — Research-credibility reframe (ragornot frontend)

**Goal:** make ragornot's benchmark read as research-grade — accurate framing, measured-vs-modeled honesty, uncertainty, and reproducibility. This lifts "Environmental validity" toward 9 and fixes the biggest credibility issue (calling a lexical proxy "accuracy"). **Frontend only.**

Run `pwd && git remote -v && git branch --show-current` → confirm `Raxorr/ragornot` on `main`. If not, STOP.

## Safety

1. `git tag backup-pre-reframe main && git push origin backup-pre-reframe`
2. `git checkout -b fix/research-credibility`. All work on this branch. Merge to `main` only after all verify gates pass.
3. **Frontend only** — do NOT touch the Lambda/AWS/CI/deploy.yml. For any data the frontend doesn't have, add a documented TODO; do NOT fabricate values.

---

## 1. Rename "accuracy" → "retrieval relevance" (the key credibility fix)

The metric currently labeled "accuracy" is a BM25 / query-term retrieval-confidence score — it measures how lexically relevant the retrieved chunks are, NOT whether the final answer is correct. Rename it **everywhere it's user-facing**, plus rename the internal field for consistency.

### Exact locations to rename (exhaustive — do NOT rename anything outside this list):

**Internal field rename** — find-and-replace `accuracyPct` → `relevancePct` across these 3 files:
- `src/lib/benchmark-data.ts` — the `BenchmarkRow` interface field + all 4 static row values + comments
- `src/components/benchmark/BenchmarkRunner.tsx` — `computeLiveRows()` computation (line ~67-68) + share card stat label (line ~327, change `"Accuracy"` → `"Relevance"`)
- `src/components/benchmark/ComparisonTable.tsx` — variable names `accuracyRows` → `relevanceRows`, `maxAccuracy` → `maxRelevance`, the bar width calc, comments

**User-facing label renames** (change the displayed word "Accuracy" → "Relevance (proxy)"):
- `ComparisonTable.tsx` — table header (line ~50): change `"Accuracy"` to `"Relevance (proxy)"`
- `ComparisonTable.tsx` — `ACCURACY_TIP` constant (line ~9): rewrite to explain it's a retrieval relevance proxy, not answer correctness. Rename the const to `RELEVANCE_TIP`.
- `ComparisonTable.tsx` — sr-only `<caption>` (line ~43): "Accuracy" → "Relevance"
- `BenchmarkRunner.tsx` — Step 3 description (line ~763-764): replace both "Accuracy %" references. Use: `"Relevance %" = avg_confidence × 100 from the retrieval model's lexical match score — not answer correctness. LLM-only has no retrieval quality metric.`
- `BenchmarkRunner.tsx` — share card stat (line ~327): `"Accuracy"` → `"Relevance"`
- `ModeIntro.tsx` — RAG "when" text (line ~36): `"Best accuracy for domain questions"` → `"Best retrieval relevance for domain questions. Justified when grounded answers matter more than cost."`
- `ModeIntro.tsx` — Confidence metric def (line ~50): remove the clause `"'Accuracy %' in the Mode Comparison table is avg_confidence × 100 from your live run."` → replace with `"'Relevance %' in the Mode Comparison table is avg_confidence × 100."`
- `benchmark/page.tsx` — hero stats (line ~33): `"highest accuracy"` → `"highest retrieval relevance"`
- `DecideTool.tsx` — (line ~202): `"accuracy tradeoff"` → `"relevance tradeoff"`
- `public/llms.txt` — (line ~9): `"combining accuracy and grounding"` → `"combining retrieval relevance and grounding"`
- `README.md` — (line ~20): `"People quote blog-post accuracy numbers"` — this is editorial commentary about the industry, NOT the metric label. Leave it as-is OR rephrase to `"People quote blog-post quality numbers"` — your call.
- `benchmark-data.ts` — RAG notes string (line ~53): `"highest accuracy"` → `"highest retrieval relevance"`

**DO NOT rename:**
- `terms/page.tsx` (line ~71) — `"accuracy"` here is a legal disclaimer ("as is, no warranty of accuracy"), NOT the metric.
- `digest.json` (line ~30) — editorial copy, `"accuracy"` is used in general sense.

**Add inline definition on first prominent use** (Step 3 Mode Comparison description in BenchmarkRunner.tsx): one sentence — "Retrieval relevance is the lexical match confidence of retrieved chunks — not answer correctness. End-answer evaluation (correctness, faithfulness, citation quality) is a planned future metric."

---

## 2. Separate MEASURED from MODELED

Add a clear, consistent visual distinction in `ImpactPanel.tsx`:

- **Measured** (from the live API / Bedrock billing): latency, token counts, cost per query. These come from the API response.
- **Modeled** (literature-derived estimates): energy, water, CO₂. These are computed from coefficients.

Implementation: add small badge/tag elements — e.g. a `<span>` with text "measured" (green-tinted) or "modeled — estimate" (amber-tinted) — next to each metric group heading in ImpactPanel. A reader must never mistake the energy/water/CO₂ figures for measurements.

Also add this distinction to ComparisonTable.tsx: the "Latency" and "Cost / query" columns are measured; if you add any modeled columns, badge them.

---

## 3. Derive energy from TOKENS, not cost

**The bug is in one place:** `src/components/benchmark/BenchmarkRunner.tsx`, function `computeLiveRows()`, lines ~55-59. It currently does:
```
energyPerQueryWh = mode === "llm" || mode === "rag" ? avgCost * 2615 : ...
```
This derives energy from dollar cost, which is wrong.

**The fix already exists:** `src/lib/impact-data.ts` exports `energyWhFromTokens(totalTokens)`. Use it:
1. In `computeLiveRows()`, compute `avgTokens` from the valid results (same pattern as `avgCost`).
2. Replace `avgCost * 2615` with `energyWhFromTokens(avgTokens)`.
3. Keep the Flat/Hierarchical near-zero static values as-is (they're correct — no LLM call).

**Also update `ModeIntro.tsx` line ~66**, the "Energy estimate" metric definition. It currently says `"Derived from cost using ~2,615 Wh/$"`. Change to: `"Derived from token count using ${ENERGY_WH_PER_1K_TOKENS} Wh per 1,000 tokens, anchored to Epoch AI's short-query figure. Lexical modes use fixed near-zero figures. CO₂ = energy × grid intensity. All are order-of-magnitude estimates, not measurements."` Import the constant from impact-data.ts.

**State the token→energy assumption explicitly** in the ImpactPanel intro text and on /methodology (it's already there on methodology — verify it still reads correctly after the change).

---

## 4. Uncertainty bands (low / mid / high)

Every modeled figure — per-query and org-scale energy/water/CO₂ — must show a range, not a single point.

**The data already exists:** `SourcedFigure.range` is populated for key figures:
- `ENERGY.chatShort`: [0.1, 0.6] Wh
- `WATER.fullScopeGpt4o`: no range yet → add one based on the scope-1 figures ([0.26, 0.32] scaled to full-scope ~4× → ~[1.0, 1.3])
- `GRID_INTENSITY_SOURCE`: [50, 480] gCO₂/kWh
- `RAG_VS_LONGCONTEXT.costMultiplier`: [20, 24]×
- `RAG_VS_LONGCONTEXT.tokenSavings`: [8, 82]×

For energy uncertainty, build low/mid/high from the `ENERGY.chatShort.range` endpoints:
- **Low** (efficient): 0.1 Wh per short query → scale tokens proportionally
- **Mid** (typical): 0.3 Wh (current default)
- **High** (conservative): 0.6 Wh

**Implementation:**
1. Add a helper in `impact-data.ts` — e.g. `energyWhFromTokensRange(totalTokens)` → returns `{ low, mid, high }`.
2. In `ImpactPanel.tsx`, compute and display the range for each modeled metric: render as `"X (low–high)"` next to the bar chart values.
3. For org-scale projections, show the range too: e.g. "$12.30/mo ($8.20–$16.40)".
4. Each range endpoint must trace to its source (Epoch AI low/high estimates). Show this on /methodology.

---

## 5. Sensitivity controls

Extend the existing grid-intensity selector in `ImpactPanel.tsx` into a small "Assumptions" panel with three controls:
1. **Grid intensity** — already exists (keep as-is)
2. **PUE** (Power Usage Effectiveness — data-center overhead multiplier): dropdown or slider, options: 1.1 (hyperscaler best), 1.2 (typical hyperscaler), 1.4 (average data center), 1.58 (global average). Default: 1.2. Source: Uptime Institute / IEA. **Add a `PUE_OPTIONS` array to `impact-data.ts`** with source citation.
3. **Per-token energy** (efficient / typical / conservative): maps to the low/mid/high from ENERGY.chatShort.range. Default: typical (0.3 Wh).

All modeled figures (energy, water, CO₂) recompute live as these change. The derivation: `effective_energy = energyWhFromTokens(tokens) × (PUE / baseline_PUE)` where baseline_PUE = 1.2 (the assumed PUE in the Epoch figure).

---

## 6. Report distributions, not just averages

In the Step 2 aggregate section of `BenchmarkRunner.tsx`:

**The data is already collected:** `allLatencies[mode]` and `allConfidences[mode]` arrays are computed at lines ~298-304. Add from these:
- min / median / max / stdev (or IQR) for latency, cost, and the relevance proxy per mode.
- Show n (currently 7).

Add below the aggregate grid: `"n = 7 — descriptive statistics only, not statistically powered. A 50–100 question golden set with expected sources is needed for significance testing (planned)."`

---

## 7. Run metadata / reproducibility stamp

Add a "Run metadata" collapsible block below the Step 4 Impact Analytics section, showing:
- **Model ID**: from config or hardcoded `"us.anthropic.claude-haiku-4-5"` (already in the JSON export's `run_metadata`)
- **Pricing version**: `"Bedrock on-demand, as of [date]"` (static string, update manually)
- **Benchmark date/time**: `new Date().toISOString()` at run start (already available from `RunRecord.startedAt`)
- **Corpus size**: `116` documents (static, from config)
- **Query count**: n (from `successCount`)
- **Index/corpus version**: show `"not reported"` + TODO comment: `// TODO: Lambda should return corpus_version and index_timestamp in the API response`
- **Prompt version**: show `"not reported"` + TODO comment: `// TODO: Lambda should return prompt_version in the API response`
- **Cold/warm status**: show `"not reported"` + TODO comment: `// TODO: Lambda should return cold_start boolean in the API response`

In your report at the end, list the recommended Lambda changes to populate the "not reported" fields.

---

## 8. Update /methodology + llms.txt

Reflect all changes on the `/methodology` page (`src/app/methodology/page.tsx`):
- The relevance-proxy renaming (verify — `/methodology` currently doesn't use "accuracy," but check if the prose needs clarifying)
- Add a "Measured vs modeled" section explaining the distinction
- The token→energy method is already documented there — verify the formula block still matches after any changes to constants
- Add the uncertainty range endpoints and their sources
- Add the sensitivity assumptions (PUE options + their source)
- Add the n=7 caveat in a "Statistical limitations" subsection

Update `public/llms.txt` with the relevance-proxy rename (line 9).

Keep all existing JSON-LD on `/decide` valid (it doesn't mention accuracy, so it should be unaffected — verify).

---

## Verify + ship

Run ALL of these before merging:
```bash
npx next build          # clean, no errors
npx eslint src --max-warnings=0  # clean
```

**Manual verification checklist:**
- [ ] No user-facing "accuracy" label remains for the proxy metric (grep `src/` for case-insensitive "accuracy" — only `terms/page.tsx` legal text and `digest.json` editorial should remain)
- [ ] Measured/modeled badges visible in ImpactPanel
- [ ] Energy is token-derived (`avgCost * 2615` is gone; `energyWhFromTokens` is used)
- [ ] `ModeIntro.tsx` energy definition updated (no more "2,615 Wh/$")
- [ ] Ranges show on modeled metrics (per-query and org-scale)
- [ ] Sensitivity controls (grid + PUE + per-token energy) work and recompute live
- [ ] Distributions (min/median/max/stdev, n) show in Step 2
- [ ] Run metadata block present with live fields + "not reported" placeholders
- [ ] `/benchmark`, `/decide`, `/methodology` render with no console errors or hydration warnings
- [ ] No backend/CI files changed: `git diff --name-only main | grep -E '(lambda|deploy|\.github)'` returns nothing

**Commit strategy:** commit per section (1 through 8), push, then:
```bash
git checkout main
git merge --no-ff fix/research-credibility
git push origin main
```

**Rollback:** `git revert -m 1 <merge-sha> && git push origin main`, or `git reset --hard backup-pre-reframe && git push --force-with-lease`.

---

## Report

When done, report:
1. What was renamed and in which files (with before/after)
2. How measured-vs-modeled is shown (screenshot or description)
3. The token→energy coefficient used + source
4. The uncertainty range endpoints + sources for each modeled metric
5. The sensitivity inputs added (PUE values + source)
6. Which run-metadata fields are live vs "not reported" TODO
7. The recommended Lambda API changes to populate "not reported" fields
8. The `next build` + `eslint` result
9. The backup tag name
