export type ChunkStatus = "draft" | "generating" | "ready" | "error";

export type LessonImage = {
  name: string;
  previewUrl: string;
  storageKey?: string;
};

export type LessonTextBlock = {
  id: string;
  text: string;
};

export type LessonBackgroundMusic = {
  name: string;
  url: string;
  storageKey?: string;
  mimeType: string;
  volume: number;
};

export type ReusableAsset = {
  id: string;
  name: string;
  kind: "image" | "audio";
  mimeType: string;
  url: string;
  storageKey: string;
  contentHash?: string;
  createdAt?: string;
};

export type ProjectTemplate = {
  id: string;
  name: string;
  voice: string;
  voiceStyle: string;
  backgroundMusic?: LessonBackgroundMusic;
  chunks: LessonChunk[];
};

export type LessonChunk = {
  id: string;
  order: number;
  displayText: string;
  speechText: string;
  voice?: string;
  voiceStyle?: string;
  durationInSeconds: number;
  status: ChunkStatus;
  textBlocks?: LessonTextBlock[];
  assets?: LessonImage[];
  /** 旧プロジェクトとの互換用。新規追加はassetsを使用します。 */
  asset?: LessonImage;
  audio?: {
    url: string;
    storageKey?: string;
    mimeType: string;
  };
};

export type LessonTheme = {
  background: "blueprint" | "chalk" | "paper";
  backgroundImage?: LessonImage;
  accent: string;
  showMainText: boolean;
};

export type LessonProject = {
  id: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  gapInSeconds: number;
  voice: string;
  voiceStyle: string;
  backgroundMusic?: LessonBackgroundMusic;
  theme: LessonTheme;
  chunks: LessonChunk[];
};
