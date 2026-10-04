import {describe, expect, it} from "vitest";
import {addImagesWithAutoLayout, addTextBlockWithAutoLayout, defaultImageLayout, defaultMainTextLayout, defaultTextBlockLayout, getVideoFontFamily, resolveImageLayout} from "./scene-layout";
import type {LessonChunk} from "./types";

const chunk = (patch: Partial<LessonChunk> = {}): LessonChunk => ({
  id: "scene-1",
  order: 0,
  displayText: "メインテキスト",
  speechText: "メインテキスト",
  durationInSeconds: 3,
  status: "draft",
  ...patch,
});

describe("scene layout", () => {
  it("places a single image at the center", () => {
    expect(defaultImageLayout(0, 1)).toEqual({widthPercent: 70, xPercent: 50, yPercent: 50});
  });

  it("places an inserted image below visible text", () => {
    expect(defaultImageLayout(0, 1, true)).toEqual({widthPercent: 58, xPercent: 50, yPercent: 68});
    expect(defaultMainTextLayout(true)).toEqual({xOffsetPercent: 0, yOffsetPercent: -32});
  });

  it("creates a balanced default grid for multiple images", () => {
    expect(defaultImageLayout(0, 4)).toEqual({widthPercent: 42, xPercent: 25, yPercent: 25});
    expect(defaultImageLayout(3, 4)).toEqual({widthPercent: 42, xPercent: 75, yPercent: 75});
  });

  it("prefers a saved custom image position", () => {
    const asset = {
      name: "diagram.png",
      previewUrl: "https://example.com/diagram.png",
      layout: {widthPercent: 54, xPercent: 31, yPercent: 62},
    };
    expect(resolveImageLayout(asset, 0, 1)).toEqual(asset.layout);
  });

  it("maps video font choices to a CSS font stack", () => {
    expect(getVideoFontFamily("serif")).toContain("Noto Serif JP");
    expect(getVideoFontFamily(undefined)).toContain("Noto Sans JP");
  });

  it("starts an additional text block below the main text", () => {
    expect(defaultTextBlockLayout()).toEqual({xOffsetPercent: 0, yOffsetPercent: 18});
  });

  it("stores independent coordinates when an image is inserted", () => {
    const result = addImagesWithAutoLayout(chunk(), [{name: "figure.png", previewUrl: "figure.png"}]);

    expect(result.textLayout).toEqual({xOffsetPercent: 0, yOffsetPercent: -32});
    expect(result.assets?.[0].layout).toEqual({widthPercent: 58, xPercent: 50, yPercent: 68});
  });

  it("preserves manually adjusted coordinates when more elements are inserted", () => {
    const result = addImagesWithAutoLayout(chunk({
      textLayout: {xOffsetPercent: 14, yOffsetPercent: -21},
      assets: [{name: "first.png", previewUrl: "first.png", layout: {widthPercent: 40, xPercent: 20, yPercent: 75}}],
    }), [{name: "second.png", previewUrl: "second.png"}]);

    expect(result.textLayout).toEqual({xOffsetPercent: 14, yOffsetPercent: -21});
    expect(result.assets?.[0].layout).toEqual({widthPercent: 40, xPercent: 20, yPercent: 75});
    expect(result.assets?.[1].layout).toBeDefined();
  });

  it("reflows automatic image positions when another image is inserted", () => {
    const first = addImagesWithAutoLayout(chunk(), [{name: "first.png", previewUrl: "first.png"}]);
    const result = addImagesWithAutoLayout(first, [{name: "second.png", previewUrl: "second.png"}]);

    expect(result.assets?.map((image) => image.layout)).toEqual([
      defaultImageLayout(0, 2, true),
      defaultImageLayout(1, 2, true),
    ]);
    expect(result.assets?.every((image) => image.layoutMode === "auto")).toBe(true);
  });

  it("gives newly inserted text its own saved position", () => {
    const result = addTextBlockWithAutoLayout(chunk(), {id: "note-1", text: "補足"});

    expect(result.textLayout).toEqual({xOffsetPercent: 0, yOffsetPercent: -18});
    expect(result.textBlocks?.[0].layout).toEqual({xOffsetPercent: 0, yOffsetPercent: 18});
  });
});
