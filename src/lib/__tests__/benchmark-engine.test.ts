import { describe, it, expect } from "vitest";
import {
  decideWinner,
  buildSummary,
  emptyModeSummary,
  WINNER_QUALITY_EPSILON,
  type ModeSummary,
} from "@/lib/benchmark-engine";
import type { ApiMode, ApiResponse, ApiLlmStats } from "@/lib/api";

function makeSummary(overrides: Partial<ModeSummary> = {}): ModeSummary {
  return { ...emptyModeSummary(), ...overrides };
}

function makeResults(
  overrides: Partial<Record<ApiMode, Partial<ModeSummary>>>,
): Record<ApiMode, ModeSummary> {
  return {
    flat: makeSummary({ latencyMs: 500, qualityProxy: 0.5, ...overrides.flat }),
    hierarchical: makeSummary({ latencyMs: 500, qualityProxy: 0.5, ...overrides.hierarchical }),
    llm: makeSummary({ latencyMs: 500, qualityProxy: null, ...overrides.llm }),
    rag: makeSummary({ latencyMs: 500, qualityProxy: 0.5, ...overrides.rag }),
  };
}

function mockApiResponse(overrides: Partial<ApiResponse> = {}): ApiResponse {
  return {
    query: "q",
    mode: "rag",
    answer_text: "",
    answer_bullets: [],
    matches: [],
    confidence: null,
    error: null,
    debug: {},
    llm_stats: null,
    retrieval_stats: null,
    ...overrides,
  };
}

describe("decideWinner", () => {
  it("picks a clear winner by quality proxy", () => {
    const results = makeResults({
      flat: { qualityProxy: 0.95 },
      hierarchical: { qualityProxy: 0.8 },
      llm: { qualityProxy: null },
      rag: { qualityProxy: 0.85 },
    });
    expect(decideWinner(results)).toBe("flat");
  });

  it("breaks a quality tie by latency", () => {
    const results = makeResults({
      flat: { qualityProxy: 0.9, latencyMs: 800 },
      hierarchical: { qualityProxy: 0.9, latencyMs: 400 },
    });
    expect(decideWinner(results)).toBe("hierarchical");
  });

  it("returns 'tie' when within quality AND latency epsilons", () => {
    const results = makeResults({
      flat: { qualityProxy: 0.9, latencyMs: 500 },
      hierarchical: { qualityProxy: 0.9, latencyMs: 520 },
    });
    expect(decideWinner(results)).toBe("tie");
  });

  it("never picks LLM-only (null qualityProxy → -1)", () => {
    const results = makeResults({
      flat: { qualityProxy: 0.5 },
      hierarchical: { qualityProxy: 0.5 },
      llm: { qualityProxy: null },
      rag: { qualityProxy: 0.5 },
    });
    expect(decideWinner(results)).not.toBe("llm");
  });

  it("returns 'failed' when every mode errored", () => {
    const results = makeResults({
      flat: { error: "timeout" },
      hierarchical: { error: "timeout" },
      llm: { error: "timeout" },
      rag: { error: "timeout" },
    });
    expect(decideWinner(results)).toBe("failed");
  });

  it("returns the single valid mode when all others errored", () => {
    const results = makeResults({
      flat: { qualityProxy: 0.5, error: null },
      hierarchical: { error: "timeout" },
      llm: { error: "timeout" },
      rag: { error: "timeout" },
    });
    expect(decideWinner(results)).toBe("flat");
  });

  it("gives a clear winner when quality is just outside the epsilon band", () => {
    const results = makeResults({
      flat: { qualityProxy: 0.9, latencyMs: 500 },
      hierarchical: { qualityProxy: 0.9 - WINNER_QUALITY_EPSILON - 0.01, latencyMs: 500 },
    });
    const winner = decideWinner(results);
    expect(winner).toBe("flat");
    expect(winner).not.toBe("tie");
  });
});

describe("buildSummary", () => {
  it("extracts fields correctly from an ApiResponse", () => {
    const data = mockApiResponse({
      confidence: 0.92,
      debug: { quality_proxy: 0.88 },
      answer_text: "test",
      llm_stats: {
        input_tokens: 200,
        output_tokens: 300,
        cost_usd: 0.00041,
        latency_ms: 999,
        model: "us.anthropic.claude-haiku-4-5",
      },
      matches: [
        { title: "A", heading: null, snippet: "", url: "" },
        { title: "B", heading: null, snippet: "", url: "" },
        { title: "C", heading: null, snippet: "", url: "" },
        { title: "D", heading: null, snippet: "", url: "" },
        { title: "E", heading: null, snippet: "", url: "" },
      ],
    });
    const s = buildSummary(data, 1500);
    expect(s.confidence).toBe(0.92);
    expect(s.qualityProxy).toBe(0.88);
    expect(s.latencyMs).toBe(1500);
    expect(s.tokens).toBe(500);
    expect(s.costUsd).toBe(0.00041);
    expect(s.topTitles).toHaveLength(3);
    expect(s.topTitles).toEqual(["A", "B", "C"]);
    expect(s.answerText).toBe("test");
    expect(s.error).toBeNull();
  });

  it("preserves modelId from llm_stats", () => {
    const llm_stats: ApiLlmStats = {
      model: "us.anthropic.claude-haiku-4-5",
      input_tokens: 100,
      output_tokens: 200,
      cost_usd: 0.0003,
      latency_ms: 500,
    };
    const data = mockApiResponse({ llm_stats });
    const summary = buildSummary(data, 1000);
    expect(summary.modelId).toBe("us.anthropic.claude-haiku-4-5");
  });

  it("modelId is null when there are no llm_stats", () => {
    const data = mockApiResponse({ llm_stats: null });
    const summary = buildSummary(data, 1000);
    expect(summary.modelId).toBeNull();
  });
});

describe("emptyModeSummary", () => {
  it("returns a zeroed summary", () => {
    const s = emptyModeSummary();
    expect(s.confidence).toBeNull();
    expect(s.qualityProxy).toBeNull();
    expect(s.latencyMs).toBe(0);
    expect(s.costUsd).toBe(0);
    expect(s.tokens).toBe(0);
    expect(s.topTitles).toEqual([]);
    expect(s.matches).toEqual([]);
    expect(s.answerText).toBe("");
    expect(s.error).toBeNull();
    expect(s.modelId).toBeNull();
  });
});
