import { describe, it, expect } from "vitest";
import { benchmarkRows } from "@/lib/benchmark-data";

describe("benchmarkRows", () => {
  it("has exactly 4 entries", () => {
    expect(benchmarkRows).toHaveLength(4);
  });

  it("includes all four modes", () => {
    const modes = benchmarkRows.map((r) => r.mode).sort();
    expect(modes).toEqual(["flat", "hierarchical", "llm-only", "rag"]);
  });

  it("all relevancePct are between 0 and 100", () => {
    for (const r of benchmarkRows) {
      expect(r.relevancePct).toBeGreaterThanOrEqual(0);
      expect(r.relevancePct).toBeLessThanOrEqual(100);
    }
  });

  it("all latencyMs are >= 0", () => {
    for (const r of benchmarkRows) expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("all costPerQueryUsd are >= 0", () => {
    for (const r of benchmarkRows) expect(r.costPerQueryUsd).toBeGreaterThanOrEqual(0);
  });

  it("Flat and Hierarchical cost exactly 0 (no LLM call)", () => {
    const flat = benchmarkRows.find((r) => r.mode === "flat");
    const hier = benchmarkRows.find((r) => r.mode === "hierarchical");
    expect(flat?.costPerQueryUsd).toBe(0);
    expect(hier?.costPerQueryUsd).toBe(0);
  });

  it("all notes are non-empty strings", () => {
    for (const r of benchmarkRows) {
      expect(typeof r.notes).toBe("string");
      expect(r.notes.length).toBeGreaterThan(0);
    }
  });
});
