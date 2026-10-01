import {describe, expect, it} from "vitest";
import {defaultImageLayout, defaultTextBlockLayout, getVideoFontFamily, resolveImageLayout} from "./scene-layout";

describe("scene layout", () => {
  it("places a single image at the center", () => {
    expect(defaultImageLayout(0, 1)).toEqual({widthPercent: 70, xPercent: 50, yPercent: 50});
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

  it("starts an additional text block from the centered offset", () => {
    expect(defaultTextBlockLayout()).toEqual({xOffsetPercent: 0, yOffsetPercent: 0});
  });
});
