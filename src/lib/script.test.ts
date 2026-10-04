import {describe, expect, it} from "vitest";
import {chunkDurationInFrames, chunkIndexAtFrame, chunkStartFrame, estimateDuration, insertChunkAfter, parseScript, toSpeechText, totalDuration, totalDurationInFrames} from "./script";

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

  it("seeks to the exact first frame of the selected chunk", () => {
    const chunks = parseScript("一行\n二行\n三行").map((chunk) => ({...chunk, durationInSeconds: 3}));
    expect(chunkDurationInFrames(chunks[0], 0.15, 30)).toBe(95);
    expect(chunkStartFrame(chunks, 0, 0.15, 30)).toBe(0);
    expect(chunkStartFrame(chunks, 1, 0.15, 30)).toBe(95);
    expect(chunkStartFrame(chunks, 2, 0.15, 30)).toBe(190);
    expect(totalDurationInFrames(chunks, 0.15, 30)).toBe(285);
  });

  it("resolves the active chunk at exact frame boundaries", () => {
    const chunks = parseScript("一行\n二行\n三行").map((chunk) => ({...chunk, durationInSeconds: 3}));
    expect(chunkIndexAtFrame(chunks, 0, 0.15, 30)).toBe(0);
    expect(chunkIndexAtFrame(chunks, 94, 0.15, 30)).toBe(0);
    expect(chunkIndexAtFrame(chunks, 95, 0.15, 30)).toBe(1);
    expect(chunkIndexAtFrame(chunks, 190, 0.15, 30)).toBe(2);
  });

  it("inserts a new chunk directly after the selected chunk", () => {
    const chunks = parseScript("一行\n二行\n三行");
    const inserted = {...parseScript("追加")[0], id: "inserted", order: 99};
    const result = insertChunkAfter(chunks, chunks[0].id, inserted);
    expect(result.map((chunk) => chunk.displayText)).toEqual(["一行", "追加", "二行", "三行"]);
    expect(result.map((chunk) => chunk.order)).toEqual([0, 1, 2, 3]);
  });
});
