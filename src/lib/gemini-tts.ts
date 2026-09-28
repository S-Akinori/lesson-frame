const STRUCTURED_SPEECH_METADATA_MODELS = [
  "gemini-3.8-flash-tts",
  "gemini-3.8-flash-lite-tts",
] as const;

export const supportsSpeechMetadata = (model: string) => (
  STRUCTURED_SPEECH_METADATA_MODELS.some((name) => model === name || model.startsWith(`${name}-`))
);

export const buildTtsInput = (model: string, text: string, style: string) => {
  if (!supportsSpeechMetadata(model)) {
    return style.trim()
      ? `${style.trim()}\n\n次の文章を読み上げてください。\n${text}`
      : text;
  }

  return [{
    type: "user_input" as const,
    content: [{
      type: "text" as const,
      text,
      annotations: style.trim()
        ? [{type: "speech_metadata" as const, style: style.trim()}]
        : [],
    }],
  }];
};
