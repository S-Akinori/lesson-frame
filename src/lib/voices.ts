export type GeminiVoice = {
  id: string;
  description: string;
};

// Gemini TTSの公式Prebuilt studio voices。表示文言のみ日本語化しています。
export const GEMINI_VOICES: GeminiVoice[] = [
  {id: "Zephyr", description: "明るい"},
  {id: "Puck", description: "快活"},
  {id: "Charon", description: "説明的"},
  {id: "Kore", description: "芯がある"},
  {id: "Fenrir", description: "感情豊か"},
  {id: "Leda", description: "若々しい"},
  {id: "Orus", description: "堂々としている"},
  {id: "Aoede", description: "軽やか"},
  {id: "Callirrhoe", description: "おおらか"},
  {id: "Autonoe", description: "明朗"},
  {id: "Enceladus", description: "息づかいが柔らかい"},
  {id: "Iapetus", description: "明瞭"},
  {id: "Umbriel", description: "自然体"},
  {id: "Algieba", description: "なめらか"},
  {id: "Despina", description: "流暢"},
  {id: "Erinome", description: "クリア"},
  {id: "Algenib", description: "少しかすれた"},
  {id: "Rasalgethi", description: "知的で説明的"},
  {id: "Laomedeia", description: "前向き"},
  {id: "Achernar", description: "柔らかい"},
  {id: "Alnilam", description: "力強い"},
  {id: "Schedar", description: "落ち着いて均一"},
  {id: "Gacrux", description: "成熟した"},
  {id: "Pulcherrima", description: "率直"},
  {id: "Achird", description: "親しみやすい"},
  {id: "Zubenelgenubi", description: "カジュアル"},
  {id: "Vindemiatrix", description: "穏やか"},
  {id: "Sadachbia", description: "生き生きしている"},
  {id: "Sadaltager", description: "博識な印象"},
  {id: "Sulafat", description: "温かい"},
];

export const VOICE_STYLE_EXAMPLES = [
  "テンポよく、落ち着いたトーンで親しみやすい口調で解説する。",
  "少しゆっくり、重要語を強調し、親しみやすく読み上げてください。",
  "テンポよく、断定しすぎない自然な講義口調で読み上げてください。",
] as const;
