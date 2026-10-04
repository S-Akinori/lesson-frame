import type {LessonElementAnimation, LessonElementAnimationType} from "@/lib/types";

export const DEFAULT_ELEMENT_ANIMATION: LessonElementAnimation = {
  type: "none",
  durationInSeconds: 0.6,
  delayInSeconds: 0,
};

export const elementAnimationOptions: Array<{value: LessonElementAnimationType; label: string}> = [
  {value: "none", label: "なし"},
  {value: "fade", label: "フェードイン"},
  {value: "slide-up", label: "下からスライド"},
  {value: "zoom-in", label: "ズームイン"},
];

export const resolveElementAnimation = (animation?: LessonElementAnimation): LessonElementAnimation => ({
  ...DEFAULT_ELEMENT_ANIMATION,
  ...animation,
});

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export const elementAnimationStyle = (
  animation: LessonElementAnimation | undefined,
  frame: number,
  fps: number,
): {opacity: number; transform: string} => {
  const resolved = resolveElementAnimation(animation);
  if (resolved.type === "none") return {opacity: 1, transform: ""};

  const startFrame = resolved.delayInSeconds * fps;
  const durationInFrames = Math.max(1, resolved.durationInSeconds * fps);
  const linearProgress = clamp((frame - startFrame) / durationInFrames, 0, 1);
  const progress = 1 - Math.pow(1 - linearProgress, 3);

  if (resolved.type === "slide-up") {
    return {opacity: progress, transform: `translateY(${Math.round((1 - progress) * 44)}px)`};
  }
  if (resolved.type === "zoom-in") {
    return {opacity: progress, transform: `scale(${0.9 + progress * 0.1})`};
  }
  return {opacity: progress, transform: ""};
};
