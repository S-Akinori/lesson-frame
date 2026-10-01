import type {LessonChunk} from "./types";

const latexPronunciations: Array<[RegExp, string]> = [
  [/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1 分の $2"],
  [/\\sqrt\{([^{}]+)\}/g, "ルート $1"],
  [/\\times/g, "かける"],
  [/\\div/g, "わる"],
  [/\\theta/g, "シータ"],
  [/\\alpha/g, "アルファ"],
  [/\\beta/g, "ベータ"],
  [/\\Delta/g, "デルタ"],
  [/=/g, " イコール "],
];

export const toSpeechText = (text: string) => {
  let result = text.replace(/\$\$?([\s\S]*?)\$\$?/g, "$1");
  latexPronunciations.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });
  return result.replace(/[{}_^]/g, " ").replace(/\s+/g, " ").trim();
};

export const estimateDuration = (speechText: string) => {
  const japaneseChars = [...speechText].length;
  return Math.max(2.2, Math.min(18, japaneseChars / 6.2 + 0.7));
};

export const parseScript = (script: string, previous: LessonChunk[] = []): LessonChunk[] => {
  const byText = new Map(previous.map((chunk) => [chunk.displayText, chunk]));
  return script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((displayText, index) => {
      const existing = byText.get(displayText);
      const speechText = existing?.speechText ?? toSpeechText(displayText);
      return {
        id: existing?.id ?? crypto.randomUUID(),
        order: index,
        displayText,
        speechText,
        voice: existing?.voice,
        voiceStyle: existing?.voiceStyle,
        durationInSeconds: existing?.durationInSeconds ?? estimateDuration(speechText),
        status: existing?.status ?? "draft",
        textBlocks: existing?.textBlocks,
        assets: existing?.assets,
        asset: existing?.asset,
        audio: existing?.audio,
      };
    });
};

export const totalDuration = (chunks: LessonChunk[], gapInSeconds: number) =>
  chunks.reduce((sum, chunk) => sum + chunk.durationInSeconds + gapInSeconds, 0);

export const chunkDurationInFrames = (chunk: LessonChunk, gapInSeconds: number, fps: number) =>
  Math.max(1, Math.ceil((chunk.durationInSeconds + gapInSeconds) * fps));

export const chunkStartFrame = (chunks: LessonChunk[], index: number, gapInSeconds: number, fps: number) =>
  chunks
    .slice(0, Math.max(0, index))
    .reduce((sum, chunk) => sum + chunkDurationInFrames(chunk, gapInSeconds, fps), 0);

export const totalDurationInFrames = (chunks: LessonChunk[], gapInSeconds: number, fps: number) =>
  Math.max(1, chunks.reduce((sum, chunk) => sum + chunkDurationInFrames(chunk, gapInSeconds, fps), 0));

export const formatDuration = (seconds: number) => {
  const value = Math.max(0, Math.round(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};
