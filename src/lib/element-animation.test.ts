import {describe, expect, it} from "vitest";
import {elementAnimationStyle, resolveElementAnimation} from "./element-animation";

describe("element animation", () => {
  it("keeps existing elements visible when animation is unset", () => {
    expect(elementAnimationStyle(undefined, 0, 30)).toEqual({opacity: 1, transform: ""});
  });

  it("honors delay and finishes a fade at the configured duration", () => {
    const animation = {type: "fade" as const, delayInSeconds: 0.5, durationInSeconds: 1};
    expect(elementAnimationStyle(animation, 14, 30).opacity).toBe(0);
    expect(elementAnimationStyle(animation, 45, 30).opacity).toBe(1);
  });

  it("uses transform-based motion for slide and zoom effects", () => {
    const slide = elementAnimationStyle({type: "slide-up", delayInSeconds: 0, durationInSeconds: 1}, 0, 30);
    const zoom = elementAnimationStyle({type: "zoom-in", delayInSeconds: 0, durationInSeconds: 1}, 15, 30);
    expect(slide).toEqual({opacity: 0, transform: "translateY(44px)"});
    expect(zoom.transform).toContain("scale(");
  });

  it("provides a stable default configuration", () => {
    expect(resolveElementAnimation(undefined)).toEqual({type: "none", durationInSeconds: 0.6, delayInSeconds: 0});
  });
});
