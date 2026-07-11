import { describe, it, expect } from "vitest";
import { formatLatency, formatCost, formatRelativeTime } from "@/lib/format";

describe("formatLatency", () => {
  it("sub-millisecond → '<1ms'", () => {
    expect(formatLatency(0.5)).toBe("<1ms");
  });
  it("milliseconds", () => {
    expect(formatLatency(150)).toBe("150ms");
  });
  it("seconds", () => {
    expect(formatLatency(2500)).toBe("2.50s");
  });
});

describe("formatCost", () => {
  it("zero", () => {
    expect(formatCost(0)).toBe("$0.00000");
  });
  it("small cost to 5 dp", () => {
    expect(formatCost(0.00041)).toBe("$0.00041");
  });
});

describe("formatRelativeTime", () => {
  it("1 hour ago", () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3_600_000).toISOString();
    expect(formatRelativeTime(oneHourAgo, now)).toBe("1 hour ago");
  });
});
