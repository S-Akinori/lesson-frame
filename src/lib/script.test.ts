import {describe, expect, it} from "vitest";
import {estimateDuration, parseScript, toSpeechText, totalDuration} from "./script";

describe("script pipeline", () => {
  it("treats each non-empty line as one chunk", () => {
    const chunks = parseScript("一行目です。\n\n二行目です。\n  三行目です。  ");
    expect(chunks).toHaveLength(3);
    expect(chunks.map((chunk) => chunk.order)).toEqual([0, 1, 2]);
    expect(chunks[2].displayText).toBe("三行目です。");
  });

  it("creates a readable candidate from common LaTeX", () => {
    expect(toSpeechText("状態方程式は $PV=nRT$ です。"))
      .toBe("状態方程式は PV イコール nRT です。");
    expect(toSpeechText("$$\\frac{a}{b}$$"))
      .toBe("a 分の b");
  });

  it("keeps duration within the MVP bounds", () => {
    expect(estimateDuration("短い文")).toBeGreaterThanOrEqual(2.2);
    expect(estimateDuration("長".repeat(500))).toBeLessThanOrEqual(18);
  });

  it("adds the configured gap to each chunk", () => {
    const chunks = parseScript("一行\n二行").map((chunk) => ({...chunk, durationInSeconds: 3}));
    expect(totalDuration(chunks, 0.15)).toBeCloseTo(6.3);
  });
});
