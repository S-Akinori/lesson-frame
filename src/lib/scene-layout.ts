import type {LessonChunk, LessonFontFamily, LessonImage, LessonImageLayout, LessonTextBlock, LessonTextLayout} from "@/lib/types";

export const defaultMainTextLayout = (hasImages = false, additionalTextCount = 0): LessonTextLayout => ({
  xOffsetPercent: 0,
  yOffsetPercent: hasImages ? -32 : additionalTextCount > 0 ? -18 : 0,
});

export const defaultTextBlockLayout = (index = 0, total = 1, hasImages = false): LessonTextLayout => {
  const safeTotal = Math.max(1, total);
  const firstY = hasImages ? -16 : safeTotal === 1 ? 18 : -2;
  const step = hasImages ? 12 : 20;
  return {
    xOffsetPercent: 0,
    yOffsetPercent: firstY + index * step,
  };
};

export const videoFontOptions: Array<{
  value: LessonFontFamily;
  label: string;
  fontFamily: string;
}> = [
  {
    value: "sans",
    label: "ゴシック",
    fontFamily: '"Noto Sans JP", "Yu Gothic", sans-serif',
  },
  {
    value: "rounded",
    label: "丸ゴシック",
    fontFamily: '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif',
  },
  {
    value: "serif",
    label: "明朝",
    fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
  },
  {
    value: "mono",
    label: "等幅",
    fontFamily: '"Noto Sans Mono", "BIZ UDGothic", monospace',
  },
];

export const getVideoFontFamily = (font: LessonFontFamily | undefined) =>
  videoFontOptions.find((option) => option.value === (font ?? "sans"))?.fontFamily ??
  videoFontOptions[0].fontFamily;

export const defaultImageLayout = (index: number, total: number, hasText = false): LessonImageLayout => {
  if (total <= 1) {
    return {widthPercent: hasText ? 58 : 70, xPercent: 50, yPercent: hasText ? 68 : 50};
  }

  const columns = total <= 4 ? 2 : 3;
  const rows = Math.ceil(total / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);

  return {
    widthPercent: columns === 2 ? (hasText ? 38 : 42) : (hasText ? 26 : 28),
    xPercent: ((column + 0.5) / columns) * 100,
    yPercent: hasText ? 52 + ((row + 0.5) / rows) * 42 : ((row + 0.5) / rows) * 100,
  };
};

export const resolveImageLayout = (asset: LessonImage, index: number, total: number, hasText = false) =>
  asset.layout ?? defaultImageLayout(index, total, hasText);

const hasVisibleText = (chunk: LessonChunk) =>
  Boolean(chunk.displayText.trim() || chunk.textBlocks?.some((block) => block.text.trim()));

/**
 * Assigns explicit initial positions only to elements that have not been moved yet.
 * Existing manual coordinates are preserved, so future inserts never move edited items.
 */
export const addImagesWithAutoLayout = (chunk: LessonChunk, images: LessonImage[]): LessonChunk => {
  const currentImages = [...(chunk.asset ? [chunk.asset] : []), ...(chunk.assets ?? [])];
  const total = currentImages.length + images.length;
  const hasText = hasVisibleText(chunk);
  const laidOut = [...currentImages, ...images].map((image, index) => {
    const preserveManualLayout = Boolean(image.layout && image.layoutMode !== "auto");
    return {
      ...image,
      layout: preserveManualLayout ? image.layout : defaultImageLayout(index, total, hasText),
      layoutMode: preserveManualLayout ? (image.layoutMode ?? "manual") : "auto" as const,
    };
  });
  const legacyOffset = chunk.asset ? 1 : 0;
  const textBlocks = (chunk.textBlocks ?? []).map((block, index, blocks) => {
    const preserveManualLayout = Boolean(block.layout && block.layoutMode !== "auto");
    return {
      ...block,
      layout: preserveManualLayout ? block.layout : defaultTextBlockLayout(index, blocks.length, total > 0),
      layoutMode: preserveManualLayout ? (block.layoutMode ?? "manual") : "auto" as const,
    };
  });
  const preserveMainTextLayout = Boolean(chunk.textLayout && chunk.textLayoutMode !== "auto");

  return {
    ...chunk,
    asset: chunk.asset ? laidOut[0] : undefined,
    assets: laidOut.slice(legacyOffset),
    textLayout: preserveMainTextLayout ? chunk.textLayout : defaultMainTextLayout(total > 0, textBlocks.length),
    textLayoutMode: preserveMainTextLayout ? (chunk.textLayoutMode ?? "manual") : "auto",
    textBlocks,
  };
};

export const addTextBlockWithAutoLayout = (chunk: LessonChunk, block: LessonTextBlock): LessonChunk => {
  const blocks = chunk.textBlocks ?? [];
  const hasImages = Boolean(chunk.asset || chunk.assets?.length);
  const nextTotal = blocks.length + 1;
  const nextBlock = {
    ...block,
    layout: block.layout ?? defaultTextBlockLayout(blocks.length, nextTotal, hasImages),
    layoutMode: block.layout ? (block.layoutMode ?? "manual" as const) : "auto" as const,
  };
  const adjustedBlocks = blocks.map((current, index) => current.layout && current.layoutMode !== "auto"
    ? current
    : {...current, layout: defaultTextBlockLayout(index, nextTotal, hasImages), layoutMode: "auto" as const});
  const preserveMainTextLayout = Boolean(chunk.textLayout && chunk.textLayoutMode !== "auto");

  return {
    ...chunk,
    textLayout: preserveMainTextLayout ? chunk.textLayout : defaultMainTextLayout(hasImages, nextTotal),
    textLayoutMode: preserveMainTextLayout ? (chunk.textLayoutMode ?? "manual") : "auto",
    textBlocks: [...adjustedBlocks, nextBlock],
  };
};
