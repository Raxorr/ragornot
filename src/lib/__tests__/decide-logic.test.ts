import { describe, it, expect } from "vitest";
import {
  decide,
  isComplete,
  QUESTIONS,
  encodeAnswers,
  decodeAnswers,
} from "@/lib/decide-logic";

const BASE: Record<string, string> = {
  need: "answers",
  data: "yes",
  cite: "yes",
  size: "large",
  churn: "changes",
  lat: "no",
  cost: "no",
  scale: "med",
};

describe("isComplete", () => {
  it("empty answers → false", () => {
    expect(isComplete({})).toBe(false);
  });
  it("all 8 answered → true", () => {
    expect(isComplete(BASE)).toBe(true);
    expect(Object.keys(BASE)).toHaveLength(QUESTIONS.length);
  });
  it("7 of 8 answered → false", () => {
    const partial = { ...BASE };
    delete partial.scale;
    expect(isComplete(partial)).toBe(false);
  });
});

describe("decide — outcome paths", () => {
  it("partial answers → null", () => {
    expect(decide({})).toBeNull();
  });

  it("need=lookup → 'none'", () => {
    const rec = decide({ ...BASE, need: "lookup" });
    expect(rec?.outcome).toBe("none");
    expect(rec?.title).toContain("don't need AI");
    expect(rec?.signals.length).toBeGreaterThan(0);
  });

  it("need=find → 'lexical'", () => {
    expect(decide({ ...BASE, need: "find" })?.outcome).toBe("lexical");
  });

  it("need=answers + data=yes → 'rag'", () => {
    expect(decide(BASE)?.outcome).toBe("rag");
  });

  it("need=answers + cite=yes → 'rag' with a citations signal", () => {
    const rec = decide(BASE);
    expect(rec?.outcome).toBe("rag");
    expect(rec?.signals.some((s) => s.includes("citations"))).toBe(true);
  });

  it("no retrieval signals + high scale → 'fine-tuning'", () => {
    const rec = decide({
      ...BASE,
      data: "no",
      cite: "no",
      size: "small",
      churn: "stable",
      scale: "high",
    });
    expect(rec?.outcome).toBe("fine-tuning");
  });

  it("no retrieval signals + low scale → 'long-context'", () => {
    const rec = decide({
      ...BASE,
      data: "no",
      cite: "no",
      size: "small",
      churn: "stable",
      scale: "low",
      cost: "no",
    });
    expect(rec?.outcome).toBe("long-context");
  });

  it("latency caveat appears when lat=yes", () => {
    const rec = decide({ ...BASE, lat: "yes" });
    expect(rec?.signals.some((s) => s.includes("latency"))).toBe(true);
  });
});

describe("encodeAnswers / decodeAnswers", () => {
  it("round-trips a full answer set", () => {
    expect(decodeAnswers(encodeAnswers(BASE))).toEqual(BASE);
  });
  it("strips invalid values on decode", () => {
    expect(decodeAnswers("need=invalid&data=yes")).toEqual({ data: "yes" });
  });
});
