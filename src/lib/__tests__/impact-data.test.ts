import { describe, it, expect } from "vitest";
import {
  ENERGY,
  WATER,
  ENERGY_UNCERTAINTY,
  ENERGY_WH_PER_1K_TOKENS,
  TYPICAL_SHORT_QUERY_TOKENS,
  GRID_OPTIONS,
  PUE_OPTIONS,
  energyWhFromTokens,
  co2GramsFromEnergy,
  waterMlFromEnergy,
  energyBand,
  energyWhFromTokensRange,
  formatEnergyWh,
  formatCo2Grams,
  formatWaterMl,
} from "@/lib/impact-data";

describe("energyWhFromTokens", () => {
  it("500 tokens → the chatShort anchor (0.3 Wh)", () => {
    expect(energyWhFromTokens(500)).toBeCloseTo(ENERGY.chatShort.value, 10);
    expect(energyWhFromTokens(500)).toBeCloseTo(0.3, 10);
  });
  it("1000 tokens → 0.6 Wh (linear)", () => {
    expect(energyWhFromTokens(1000)).toBeCloseTo(0.6, 10);
  });
  it("0 tokens → falls back to the chatShort anchor", () => {
    expect(energyWhFromTokens(0)).toBe(ENERGY.chatShort.value);
  });
  it("negative tokens → falls back to the chatShort anchor", () => {
    expect(energyWhFromTokens(-100)).toBe(ENERGY.chatShort.value);
  });
});

describe("co2GramsFromEnergy", () => {
  it("1 Wh at 400 gCO₂/kWh → 0.4 g", () => {
    expect(co2GramsFromEnergy(1, 400)).toBeCloseTo(0.4, 10);
  });
  it("0.3 Wh at the default grid (400) → 0.12 g", () => {
    expect(co2GramsFromEnergy(0.3)).toBeCloseTo(0.12, 10);
  });
  it("0.3 Wh at 50 gCO₂/kWh → 0.015 g", () => {
    expect(co2GramsFromEnergy(0.3, 50)).toBeCloseTo(0.015, 10);
  });
});

describe("waterMlFromEnergy", () => {
  it("full-scope: 0.3 Wh → the full-scope figure (1.2 mL)", () => {
    expect(waterMlFromEnergy(0.3, "fullScope")).toBeCloseTo(WATER.fullScopeGpt4o.value, 10);
    expect(waterMlFromEnergy(0.3, "fullScope")).toBeCloseTo(1.2, 10);
  });
  it("scope-1: 0.3 Wh → the scope-1 figure (0.32 mL)", () => {
    expect(waterMlFromEnergy(0.3, "scope1")).toBeCloseTo(WATER.scope1OpenAI.value, 10);
    expect(waterMlFromEnergy(0.3, "scope1")).toBeCloseTo(0.32, 10);
  });
  it("double the energy → double the water", () => {
    expect(waterMlFromEnergy(0.6, "fullScope")).toBeCloseTo(2.4, 10);
  });
});

describe("energyBand / energyWhFromTokensRange", () => {
  it("band ratios match ENERGY_UNCERTAINTY", () => {
    const b = energyBand(0.3);
    expect(b.low).toBeCloseTo(0.3 * ENERGY_UNCERTAINTY.lowRatio, 10);
    expect(b.high).toBeCloseTo(0.3 * ENERGY_UNCERTAINTY.highRatio, 10);
    expect(b.low).toBeCloseTo(0.1, 10);
    expect(b.mid).toBeCloseTo(0.3, 10);
    expect(b.high).toBeCloseTo(0.6, 10);
  });
  it("energyWhFromTokensRange(500) → {low ~0.1, mid 0.3, high ~0.6}", () => {
    const b = energyWhFromTokensRange(500);
    expect(b.low).toBeCloseTo(0.1, 10);
    expect(b.mid).toBeCloseTo(0.3, 10);
    expect(b.high).toBeCloseTo(0.6, 10);
  });
});

describe("constants sanity", () => {
  it("ENERGY_WH_PER_1K_TOKENS = chatShort / (typical/1000) = 0.6", () => {
    expect(ENERGY_WH_PER_1K_TOKENS).toBeCloseTo(ENERGY.chatShort.value / (TYPICAL_SHORT_QUERY_TOKENS / 1000), 10);
    expect(ENERGY_WH_PER_1K_TOKENS).toBeCloseTo(0.6, 10);
  });
  it("GRID_OPTIONS has ≥3 entries, all gPerKwh > 0", () => {
    expect(GRID_OPTIONS.length).toBeGreaterThanOrEqual(3);
    for (const g of GRID_OPTIONS) expect(g.gPerKwh).toBeGreaterThan(0);
  });
  it("PUE_OPTIONS has ≥3 entries, all value ≥ 1.0", () => {
    expect(PUE_OPTIONS.length).toBeGreaterThanOrEqual(3);
    for (const p of PUE_OPTIONS) expect(p.value).toBeGreaterThanOrEqual(1.0);
  });
});

describe("formatters", () => {
  it("formatEnergyWh", () => {
    expect(formatEnergyWh(0.0001)).toBe("<0.001 Wh");
    expect(formatEnergyWh(0.3)).toBe("0.300 Wh");
    expect(formatEnergyWh(1.5)).toBe("1.5 Wh");
  });
  it("formatCo2Grams", () => {
    expect(formatCo2Grams(0.0001)).toBe("<0.001 g");
    expect(formatCo2Grams(1500)).toBe("1.50 kg");
  });
  it("formatWaterMl", () => {
    expect(formatWaterMl(0.001)).toBe("<0.01 mL");
    expect(formatWaterMl(1500)).toBe("1.50 L");
  });
});
