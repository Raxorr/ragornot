# Prompt #2 — Testing foundation + CI gates (ragornot)

**Goal:** add a real test suite and make lint/typecheck/tests gate every deploy. This is the single biggest engineering-process gap — the evaluation rates Testing at 5.3/10 and CI/CD at 7.3/10. This prompt lifts both toward ~8.5+. Also fixes a confirmed export bug. **Frontend only.**

Run `pwd && git remote -v && git branch --show-current` → confirm `Raxorr/ragornot` on `main`. If not, STOP.

## Safety

1. `git tag backup-pre-testing main && git push origin backup-pre-testing`
2. `git checkout -b feat/testing-ci`. All work on this branch. Merge to `main` only after all verify gates pass.
3. **Frontend only** — do NOT touch the Lambda/AWS backend.

---

## 1. Install test tooling

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

**Create `vitest.config.ts`** in project root:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/lib/**", "src/components/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Create `src/__tests__/setup.ts`:**

```ts
import "@testing-library/jest-dom/vitest";
```

**Add scripts to `package.json`** — add these three entries to the `"scripts"` object (keep all existing scripts):

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

---

## 2. Unit tests — `benchmark-engine.ts`

**Create `src/lib/__tests__/benchmark-engine.test.ts`.**

This is the highest-credibility test file — it proves the winner logic is correct. The evaluation specifically flagged this as highest-priority.

Test these cases (import `decideWinner`, `buildSummary`, `emptyModeSummary`, `MODES`, `WINNER_QUALITY_EPSILON`, `WINNER_LATENCY_TIE_MS` from `@/lib/benchmark-engine`):

### `decideWinner()` tests:

1. **Clear winner by quality.** Set flat qualityProxy=0.95, hierarchical=0.80, llm=null (→ -1), rag=0.85. All latencies 500ms. Expect winner = `"flat"`.

2. **Quality tie → latency tiebreaker.** Set flat qualityProxy=0.90, hierarchical=0.90 (diff=0, within epsilon). Flat latency=800ms, hierarchical=400ms. Expect winner = `"hierarchical"` (lower latency wins).

3. **Full tie — within quality AND latency epsilon.** Set flat qualityProxy=0.90, hierarchical=0.90 (within 5%). Flat latency=500ms, hierarchical=520ms (diff=20ms, within 40ms). Expect winner = `"tie"`.

4. **LLM-only never wins (null qualityProxy → -1).** Set llm qualityProxy=null, all others=0.50, all latencies equal. Expect winner is NOT `"llm"`.

5. **All modes errored → "failed".** Set all 4 modes with `error: "timeout"`. Expect `"failed"`.

6. **Single valid mode wins by default.** Set flat with no error, others all errored. Expect winner = `"flat"`.

7. **Quality just outside epsilon triggers clear winner.** Set flat qualityProxy=0.90, hierarchical=0.90 - WINNER_QUALITY_EPSILON - 0.01 (just outside 5% band). Expect winner = `"flat"`, not `"tie"`.

### `buildSummary()` test:

8. **Extracts fields correctly.** Create a mock `ApiResponse` with confidence=0.92, quality_proxy=0.88, cost_usd=0.00041, input_tokens=200, output_tokens=300, answer_text="test", 5 matches. Call `buildSummary(data, 1500)`. Verify: confidence=0.92, qualityProxy=0.88, latencyMs=1500, tokens=500, costUsd=0.00041, topTitles has 3 items (sliced from 5 matches), answerText="test", error=null.

### `emptyModeSummary()` test:

9. **Returns zeroed summary.** Verify all numeric fields are 0 or null, arrays are empty, error is null.

### Helper:

For tests 1–7, use a helper factory function at the top of the test file:

```ts
function makeSummary(overrides: Partial<ModeSummary> = {}): ModeSummary {
  return { ...emptyModeSummary(), ...overrides };
}

function makeResults(overrides: Partial<Record<ApiMode, Partial<ModeSummary>>>): Record<ApiMode, ModeSummary> {
  return {
    flat: makeSummary({ latencyMs: 500, qualityProxy: 0.5, ...overrides.flat }),
    hierarchical: makeSummary({ latencyMs: 500, qualityProxy: 0.5, ...overrides.hierarchical }),
    llm: makeSummary({ latencyMs: 500, qualityProxy: null, ...overrides.llm }),
    rag: makeSummary({ latencyMs: 500, qualityProxy: 0.5, ...overrides.rag }),
  };
}
```

---

## 3. Unit tests — `impact-data.ts`

**Create `src/lib/__tests__/impact-data.test.ts`.**

These prove the published environmental formulas are correct. Import from `@/lib/impact-data`.

### `energyWhFromTokens()` tests:

1. **500 tokens → ENERGY.chatShort.value (0.3 Wh).** This is the anchor case — 500 tokens at 0.6 Wh/1k tokens = 0.3 Wh.

2. **1000 tokens → 0.6 Wh.** Linear scaling: 1000/1000 × 0.6 = 0.6.

3. **0 tokens → falls back to ENERGY.chatShort.value (0.3 Wh).** The function's explicit fallback for missing token data.

4. **Negative tokens → falls back to 0.3 Wh.** Same guard.

### `co2GramsFromEnergy()` tests:

5. **1 Wh at 400 gCO₂/kWh → 0.4 g.** Formula: (1/1000) × 400 = 0.4.

6. **0.3 Wh at default grid (400) → 0.12 g.** (0.3/1000) × 400 = 0.12.

7. **Custom grid: 0.3 Wh at 50 gCO₂/kWh → 0.015 g.** Low-carbon region.

### `waterMlFromEnergy()` tests:

8. **Full-scope: 0.3 Wh → WATER.fullScopeGpt4o.value (1.2 mL).** Since 0.3 Wh = chatShort baseline, ratio=1, water=1.2.

9. **Scope-1: 0.3 Wh → WATER.scope1OpenAI.value (0.32 mL).** Same ratio, different base.

10. **Double energy → double water.** 0.6 Wh full-scope → 2.4 mL.

### `energyBand()` / `energyWhFromTokensRange()` tests:

11. **Band ratios match ENERGY_UNCERTAINTY.** For mid=0.3: low=0.3×(0.1/0.3)=0.1, high=0.3×(0.6/0.3)=0.6.

12. **energyWhFromTokensRange(500) returns {low: ~0.1, mid: 0.3, high: ~0.6}.**

### Constants sanity tests:

13. **ENERGY_WH_PER_1K_TOKENS = ENERGY.chatShort.value / (TYPICAL_SHORT_QUERY_TOKENS / 1000).** Verify it equals 0.6.

14. **GRID_OPTIONS has at least 3 entries, all have gPerKwh > 0.**

15. **PUE_OPTIONS has at least 3 entries, all have value >= 1.0.**

### Formatters:

16. **formatEnergyWh(0.0001) → "<0.001 Wh".** Below-threshold formatting.
17. **formatEnergyWh(0.3) → "0.300 Wh".** Standard case.
18. **formatEnergyWh(1.5) → "1.5 Wh".** Above 1 Wh.
19. **formatCo2Grams(0.0001) → "<0.001 g".**
20. **formatCo2Grams(1500) → "1.50 kg".** Crosses the kg threshold.
21. **formatWaterMl(0.001) → "<0.01 mL".**
22. **formatWaterMl(1500) → "1.50 L".** Crosses the L threshold.

---

## 4. Unit tests — `decide-logic.ts`

**Create `src/lib/__tests__/decide-logic.test.ts`.**

The decision tree is deterministic — every path must be tested. Import `decide`, `isComplete`, `QUESTIONS`, `encodeAnswers`, `decodeAnswers` from `@/lib/decide-logic`.

### `isComplete()` tests:

1. **Empty answers → false.**
2. **All 8 questions answered → true.**
3. **7 of 8 answered → false.**

### `decide()` — one test per outcome path:

Use this base "all-answered" fixture:

```ts
const BASE: Record<string, string> = {
  need: "answers", data: "yes", cite: "yes",
  size: "large", churn: "changes",
  lat: "no", cost: "no", scale: "med",
};
```

4. **Partial answers → null.** `decide({})` returns null.

5. **need=lookup → outcome "none".** `{ ...BASE, need: "lookup" }`. Verify outcome="none", title contains "don't need AI", signals array is non-empty.

6. **need=find → outcome "lexical".** `{ ...BASE, need: "find" }`. Verify outcome="lexical".

7. **need=answers + data=yes → outcome "rag".** Use `BASE` as-is. Verify outcome="rag".

8. **need=answers + data=yes + cite=yes → outcome "rag" with citation signal.** Verify signals includes a string containing "citations".

9. **need=answers + no retrieval signals + high scale → outcome "fine-tuning".** `{ ...BASE, data: "no", cite: "no", size: "small", churn: "stable", scale: "high" }`. Verify outcome="fine-tuning".

10. **need=answers + no retrieval signals + low scale → outcome "long-context".** `{ ...BASE, data: "no", cite: "no", size: "small", churn: "stable", scale: "low", cost: "no" }`. Verify outcome="long-context".

11. **Latency caveat appears when lat=yes.** Set `lat: "yes"` on a RAG-path answer set. Verify signals includes a string containing "latency".

### `encodeAnswers()` / `decodeAnswers()` round-trip:

12. **Encode then decode returns the same answers.** `decodeAnswers(encodeAnswers(BASE))` deep-equals `BASE`.

13. **Invalid values are stripped by decodeAnswers.** `decodeAnswers("need=invalid&data=yes")` → only `data: "yes"` survives.

---

## 5. Unit tests — `format.ts`

**Create `src/lib/__tests__/format.test.ts`.**

Import from `@/lib/format`.

1. **formatLatency(0.5) → "<1ms".**
2. **formatLatency(150) → "150ms".**
3. **formatLatency(2500) → "2.50s".**
4. **formatCost(0) → "$0.00000".**
5. **formatCost(0.00041) → "$0.00041".**
6. **formatRelativeTime: 1 hour ago → "1 hour ago".** Pass `isoDate` = `new Date(now.getTime() - 3600000).toISOString()` and `now`.

---

## 6. Unit tests — `benchmark-data.ts`

**Create `src/lib/__tests__/benchmark-data.test.ts`.**

1. **benchmarkRows has exactly 4 entries.**
2. **All modes are present: flat, hierarchical, llm-only, rag.**
3. **All relevancePct are 0–100.**
4. **All latencyMs are >= 0.**
5. **All costPerQueryUsd are >= 0.**
6. **Flat and Hierarchical have costPerQueryUsd === 0.** (No LLM call.)
7. **All notes are non-empty strings.**

---

## 7. Fix the model ID export bug

The evaluation identified a confirmed bug in `BenchmarkRunner.tsx` lines ~170-175:

```ts
let modelId = "";
outer: for (const r of results) {
  for (const m of ["llm", "rag"] as ApiMode[]) {
    if (!r[m].error && r[m].tokens > 0) { modelId = ""; break outer; }
  }
}
```

This finds a valid LLM/RAG result and then sets `modelId = ""` — so the export always falls through to the hardcoded fallback. The root cause is that `ModeSummary` doesn't store the model ID from the API response.

### Fix in three places:

**A. `src/lib/benchmark-engine.ts` — add `modelId` to `ModeSummary`:**

Add `modelId: string | null;` to the `ModeSummary` interface (after `error`).

In `buildSummary()`, add: `modelId: data.llm_stats?.model ?? null,`

In `emptyModeSummary()`, add: `modelId: null,`

**B. `src/components/benchmark/BenchmarkRunner.tsx` — fix the export loop (lines ~170-175):**

Replace the broken `outer:` loop with:

```ts
let modelId = "";
for (const r of results) {
  for (const m of ["llm", "rag"] as ApiMode[]) {
    if (!r[m].error && r[m].tokens > 0 && r[m].modelId) {
      modelId = r[m].modelId;
      break;
    }
  }
  if (modelId) break;
}
```

**C. Add `modelId` to the per-mode JSON export object** (lines ~200-208), after `error`:

```ts
model_id: r[m].modelId,
```

### Write a test for this fix:

**Add to `src/lib/__tests__/benchmark-engine.test.ts`:**

Test that `buildSummary()` preserves the model ID from `ApiLlmStats`:

```ts
it("preserves modelId from llm_stats", () => {
  const data = mockApiResponse({ llm_stats: { model: "us.anthropic.claude-haiku-4-5", input_tokens: 100, output_tokens: 200, cost_usd: 0.0003, latency_ms: 500 } });
  const summary = buildSummary(data, 1000);
  expect(summary.modelId).toBe("us.anthropic.claude-haiku-4-5");
});

it("modelId is null when no llm_stats", () => {
  const data = mockApiResponse({ llm_stats: null });
  const summary = buildSummary(data, 1000);
  expect(summary.modelId).toBeNull();
});
```

---

## 8. CI gates — update `deploy.yml`

Add lint, typecheck, and test steps **before** the build step in `.github/workflows/deploy.yml`. Insert these three steps between "Install dependencies" and "Fetch fresh news":

```yaml
      - name: Lint
        run: npx eslint src --max-warnings=0

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm run test
```

The full `build` job steps should now be (in order):
1. Checkout
2. Setup Node
3. Install dependencies (`npm ci`)
4. **Lint** ← NEW
5. **Typecheck** ← NEW
6. **Test** ← NEW
7. Fetch fresh news
8. Build
9. Upload pages artifact

If any gate fails, the deploy is blocked. This is the core CI improvement.

---

## 9. Update `.gitignore`

Add `coverage/` if not already present (it's listed as `/coverage` — verify the pattern catches nested paths too; the current `/coverage` is fine for Vitest's default output location).

---

## Verify + ship

Run ALL of these before merging:

```bash
npm run test                    # all tests pass
npm run typecheck               # clean, no errors
npx eslint src --max-warnings=0 # clean
npm run build                   # clean
```

Verify:
- [ ] `npm run test` passes with 0 failures
- [ ] Test count: at minimum 40+ test cases across 5 test files
- [ ] `npm run typecheck` exits 0
- [ ] `npx eslint src --max-warnings=0` exits 0
- [ ] `npm run build` succeeds (no regressions from the `ModeSummary.modelId` addition)
- [ ] `deploy.yml` has lint → typecheck → test before build
- [ ] The model ID bug is fixed: the `outer:` loop is replaced, `ModeSummary` has `modelId`, and the JSON export includes `model_id` per mode
- [ ] No backend/CI-unrelated files changed: `git diff --name-only main | grep -E '(lambda|\.github/workflows/news)'` returns nothing
- [ ] `deploy.yml` is the ONLY workflow file changed

**Commit strategy:** commit in logical groups:
1. Vitest setup + config + package.json scripts
2. benchmark-engine tests
3. impact-data tests
4. decide-logic tests
5. format + benchmark-data tests
6. Model ID bug fix + its tests
7. CI gates (deploy.yml)

Then:
```bash
git checkout main
git merge --no-ff feat/testing-ci
git push origin main
```

**Rollback:** `git revert -m 1 <merge-sha> && git push origin main`, or `git reset --hard backup-pre-testing && git push --force-with-lease`.

---

## Report

When done, report:
1. Test file count + total test case count
2. Which test files exist and what each covers
3. The model ID bug: before/after code
4. The exact `deploy.yml` diff (new steps added)
5. `npm run test` output (pass count)
6. `npm run typecheck` output
7. `npx eslint src --max-warnings=0` output
8. `npm run build` output
9. The backup tag name
10. Any unexpected issues encountered during testing (type errors, missing types, etc.)
