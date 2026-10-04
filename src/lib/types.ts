export type ChunkStatus = "draft" | "generating" | "ready" | "error";

export type LessonImageLayout = {
  widthPercent: number;
  xPercent: number;
  yPercent: number;
};

export type LessonElementAnimationType = "none" | "fade" | "slide-up" | "zoom-in";

export type LessonElementAnimation = {
  type: LessonElementAnimationType;
  durationInSeconds: number;
  delayInSeconds: number;
};

export type LessonImage = {
  name: string;
  previewUrl: string;
  storageKey?: string;
  layout?: LessonImageLayout;
  layoutMode?: "auto" | "manual";
  animation?: LessonElementAnimation;
};

export type LessonTextLayout = {
  xOffsetPercent: number;
  yOffsetPercent: number;
};

export type LessonTextBlock = {
  id: string;
  text: string;
  style?: LessonTextStyle;
  layout?: LessonTextLayout;
  layoutMode?: "auto" | "manual";
  animation?: LessonElementAnimation;
};

export type LessonFontFamily = "sans" | "rounded" | "serif" | "mono";

export type LessonTextStyle = {
  fontSize?: number;
  fontFamily?: LessonFontFamily;
  color?: string;
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
  textStyle?: LessonTextStyle;
  textLayout?: LessonTextLayout;
  textLayoutMode?: "auto" | "manual";
  textAnimation?: LessonElementAnimation;
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
