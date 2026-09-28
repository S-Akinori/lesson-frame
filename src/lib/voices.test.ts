import {describe, expect, it} from "vitest";
import {GEMINI_VOICES, VOICE_STYLE_EXAMPLES} from "./voices";

describe("Gemini voice catalog", () => {
  it("contains all 30 unique prebuilt studio voices", () => {
    expect(GEMINI_VOICES).toHaveLength(30);
    expect(new Set(GEMINI_VOICES.map((voice) => voice.id)).size).toBe(30);
  });

  it("provides useful labels and style examples", () => {
    expect(GEMINI_VOICES.every((voice) => voice.description.length > 0)).toBe(true);
    expect(VOICE_STYLE_EXAMPLES.every((example) => example.length <= 300)).toBe(true);
  });
});
