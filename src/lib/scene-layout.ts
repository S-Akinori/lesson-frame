import type {LessonFontFamily, LessonImage, LessonImageLayout, LessonTextLayout} from "@/lib/types";

export const defaultTextBlockLayout = (): LessonTextLayout => ({
  xOffsetPercent: 0,
  yOffsetPercent: 0,
});

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

export const defaultImageLayout = (index: number, total: number): LessonImageLayout => {
  if (total <= 1) {
    return {widthPercent: 70, xPercent: 50, yPercent: 50};
  }

  const columns = total <= 4 ? 2 : 3;
  const rows = Math.ceil(total / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);

  return {
    widthPercent: columns === 2 ? 42 : 28,
    xPercent: ((column + 0.5) / columns) * 100,
    yPercent: ((row + 0.5) / rows) * 100,
  };
};

export const resolveImageLayout = (asset: LessonImage, index: number, total: number) =>
  asset.layout ?? defaultImageLayout(index, total);
