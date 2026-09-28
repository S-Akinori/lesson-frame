import {describe, expect, it} from "vitest";
import {buildTtsInput, supportsSpeechMetadata} from "@/lib/gemini-tts";

describe("Gemini TTS input", () => {
  it("uses speech metadata annotations with Gemini 3.8 TTS", () => {
    expect(supportsSpeechMetadata("gemini-3.8-flash-lite-tts")).toBe(true);
    expect(buildTtsInput("gemini-3.8-flash-lite-tts", "本文です。", "ゆっくり")).toEqual([{
      type: "user_input",
      content: [{
        type: "text",
        text: "本文です。",
        annotations: [{type: "speech_metadata", style: "ゆっくり"}],
      }],
    }]);
  });

  it("uses a plain prompt with the legacy Gemini 3.1 preview model", () => {
    expect(supportsSpeechMetadata("gemini-3.1-flash-tts-preview")).toBe(false);
    expect(buildTtsInput("gemini-3.1-flash-tts-preview", "本文です。", "ゆっくり")).toBe(
      "ゆっくり\n\n次の文章を読み上げてください。\n本文です。",
    );
  });

  it("does not add an empty speech annotation", () => {
    expect(buildTtsInput("gemini-3.8-flash-tts", "本文です。", "  ")).toEqual([{
      type: "user_input",
      content: [{type: "text", text: "本文です。", annotations: []}],
    }]);
  });
});
