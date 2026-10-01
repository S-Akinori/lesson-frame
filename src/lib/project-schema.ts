import {z} from "zod";

const imageLayoutSchema = z.object({
  widthPercent: z.number().min(10).max(100),
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
});

const assetSchema = z.object({
  name: z.string().max(180),
  previewUrl: z.string(),
  storageKey: z.string().optional(),
  layout: imageLayoutSchema.optional(),
});

const audioSchema = z.object({
  url: z.string(),
  storageKey: z.string().optional(),
  mimeType: z.string(),
});

const backgroundMusicSchema = audioSchema.extend({
  name: z.string().min(1).max(180),
  volume: z.number().min(0).max(1),
});

const textStyleSchema = z.object({
  fontSize: z.number().min(24).max(120).optional(),
  fontFamily: z.enum(["sans", "rounded", "serif", "mono"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const textLayoutSchema = z.object({
  xOffsetPercent: z.number().finite(),
  yOffsetPercent: z.number().finite(),
});

const textBlockSchema = z.object({
  id: z.string(),
  text: z.string().max(300),
  style: textStyleSchema.optional(),
  layout: textLayoutSchema.optional(),
});

export const projectSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(120),
  fps: z.number().int().min(24).max(60),
  width: z.number().int().min(640).max(3840),
  height: z.number().int().min(360).max(2160),
  gapInSeconds: z.number().min(0).max(2),
  voice: z.string().min(1).max(80),
  voiceStyle: z.string().max(300),
  backgroundMusic: backgroundMusicSchema.optional(),
  theme: z.object({
    background: z.enum(["blueprint", "chalk", "paper"]),
    backgroundImage: assetSchema.optional(),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    showMainText: z.boolean(),
  }),
  chunks: z.array(z.object({
    id: z.string(),
    order: z.number().int().min(0),
    displayText: z.string().max(300),
    textStyle: textStyleSchema.optional(),
    textLayout: textLayoutSchema.optional(),
    speechText: z.string().max(500),
    voice: z.string().min(1).max(80).optional(),
    voiceStyle: z.string().max(300).optional(),
    durationInSeconds: z.number().min(0.2).max(60),
    status: z.enum(["draft", "generating", "ready", "error"]),
    textBlocks: z.array(textBlockSchema).max(10).optional(),
    assets: z.array(assetSchema).max(12).optional(),
    asset: assetSchema.optional(),
    audio: audioSchema.optional(),
  })).min(1).max(100),
});
