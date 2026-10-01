import "katex/dist/katex.min.css";
import {useEffect, useRef} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import {AbsoluteFill, Audio, Img, Sequence} from "remotion";
import {defaultTextBlockLayout, getVideoFontFamily, resolveImageLayout} from "../../lib/scene-layout";
import {chunkDurationInFrames} from "../../lib/script";
import type {LessonChunk, LessonImageLayout, LessonProject, LessonTextBlock, LessonTextLayout, LessonTextStyle} from "../../lib/types";
import {LatexText} from "./latex-text";

const backgrounds = {
  blueprint: {base: "#07121e", grid: "rgba(95, 142, 171, 0.12)", text: "#f5f7f8", muted: "#c7d2d9"},
  chalk: {base: "#17231f", grid: "rgba(226, 232, 227, 0.07)", text: "#f7f6ee", muted: "#d8ddd7"},
  paper: {base: "#ece8dc", grid: "rgba(44, 55, 61, 0.08)", text: "#1d272b", muted: "#34444a"},
} as const;

const displayFontSize = (text: string, hasAssets: boolean, textCount: number) => {
  const length = [...text.replace(/\$+/g, "")].length;
  const densityAdjustment = textCount > 2 ? 8 : textCount > 1 ? 4 : 0;
  if (hasAssets) return (length > 72 ? 44 : length > 42 ? 52 : 60) - densityAdjustment;
  return (length > 95 ? 46 : length > 58 ? 56 : 70) - densityAdjustment;
};

function ScienceMarks({color}: {color: string}) {
  return (
    <svg viewBox="0 0 1920 1080" style={{position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.28}}>
      <g fill="none" stroke={color} strokeWidth="3">
        <path d="M94 190h250M112 96v208M128 270c48-118 108-118 174-38" />
        <circle cx="1640" cy="178" r="98" /><path d="M1542 178h196M1640 80v196M1581 256l115-152" />
        <path d="M130 884h280M160 710v202M165 857l76-93 100 80" />
        <path d="M1654 696c-120 80-120 222 0 300M1780 696c120 80 120 222 0 300M1654 696c72 72 54 228 0 300M1780 696c-72 72-54 228 0 300" />
      </g>
    </svg>
  );
}

type SceneProps = {
  chunk: LessonChunk;
  project: LessonProject;
  editableAssetIndex?: number;
  editableTextBlockId?: string;
  isEditable?: boolean;
  onAssetLayoutChange?: (index: number, layout: LessonImageLayout) => void;
  onAssetSelect?: (index: number) => void;
  onMainTextLayoutChange?: (layout: LessonTextLayout) => void;
  onMainTextStyleChange?: (style: LessonTextStyle) => void;
  onTextBlockLayoutChange?: (id: string, layout: LessonTextLayout) => void;
  onTextBlockSelect?: (id: string) => void;
  onTextBlockStyleChange?: (id: string, style: LessonTextStyle) => void;
};

export const MAIN_TEXT_ELEMENT_ID = "__main-text__";

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const roundPercentage = (value: number) => Math.round(value * 10) / 10;

function Scene({
  chunk,
  project,
  editableAssetIndex,
  editableTextBlockId,
  isEditable = false,
  onAssetLayoutChange,
  onAssetSelect,
  onMainTextLayoutChange,
  onMainTextStyleChange,
  onTextBlockLayoutChange,
  onTextBlockSelect,
  onTextBlockStyleChange,
}: SceneProps) {
  const imageStageRef = useRef<HTMLDivElement>(null);
  const textStageRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{
    assetIndex: number;
    mode: "move" | "resize";
    pointerX: number;
    pointerY: number;
    layout: LessonImageLayout;
  } | null>(null);
  const textInteractionRef = useRef<{
    blockId: string | null;
    mode: "move" | "resize";
    pointerX: number;
    pointerY: number;
    layout: LessonTextLayout;
    style: LessonTextStyle;
  } | null>(null);
  const palette = backgrounds[project.theme.background];
  const assets = [...(chunk.asset ? [chunk.asset] : []), ...(chunk.assets ?? [])].filter((asset) => asset.previewUrl);
  const textBlocks = (chunk.textBlocks ?? []).filter((block) => block.text.trim());
  const hasAssets = assets.length > 0;
  const textCount = (project.theme.showMainText && chunk.displayText.trim() ? 1 : 0) + textBlocks.length;
  const hasBackgroundImage = Boolean(project.theme.backgroundImage?.previewUrl);
  const textColor = hasBackgroundImage ? "#ffffff" : palette.text;
  const selectedTextColor = chunk.textStyle?.color ?? textColor;
  const selectedFontFamily = getVideoFontFamily(chunk.textStyle?.fontFamily);
  const mainFontSize = chunk.textStyle?.fontSize ?? displayFontSize(chunk.displayText, hasAssets, textCount);
  const mainTextLayout = chunk.textLayout ?? defaultTextBlockLayout();
  const isMainTextSelected = isEditable && editableTextBlockId === MAIN_TEXT_ELEMENT_ID;

  const startAssetInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    assetIndex: number,
    layout: LessonImageLayout,
    mode: "move" | "resize",
  ) => {
    if (!isEditable || !imageStageRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      assetIndex,
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      layout,
    };
    onAssetSelect?.(assetIndex);
  };

  const startTextInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    block: LessonTextBlock,
    defaultFontSize: number,
    mode: "move" | "resize",
  ) => {
    if (!isEditable || !textStageRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    textInteractionRef.current = {
      blockId: block.id,
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      layout: block.layout ?? defaultTextBlockLayout(),
      style: {...chunk.textStyle, ...block.style, fontSize: block.style?.fontSize ?? chunk.textStyle?.fontSize ?? defaultFontSize},
    };
    onTextBlockSelect?.(block.id);
  };

  const startMainTextInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    defaultFontSize: number,
    mode: "move" | "resize",
  ) => {
    if (!isEditable || !textStageRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    textInteractionRef.current = {
      blockId: null,
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      layout: chunk.textLayout ?? defaultTextBlockLayout(),
      style: {...chunk.textStyle, fontSize: chunk.textStyle?.fontSize ?? defaultFontSize},
    };
    onTextBlockSelect?.(MAIN_TEXT_ELEMENT_ID);
  };

  useEffect(() => {
    const moveAsset = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      const stage = imageStageRef.current;
      if (!interaction || !onAssetLayoutChange || !stage) return;
      if (event.cancelable) event.preventDefault();
      const bounds = stage.getBoundingClientRect();
      if (interaction.mode === "move") {
        onAssetLayoutChange(interaction.assetIndex, {
          ...interaction.layout,
          xPercent: roundPercentage(clamp(interaction.layout.xPercent + ((event.clientX - interaction.pointerX) / bounds.width) * 100, 0, 100)),
          yPercent: roundPercentage(clamp(interaction.layout.yPercent + ((event.clientY - interaction.pointerY) / bounds.height) * 100, 0, 100)),
        });
        return;
      }
      onAssetLayoutChange(interaction.assetIndex, {
        ...interaction.layout,
        widthPercent: roundPercentage(clamp(interaction.layout.widthPercent + ((event.clientX - interaction.pointerX) / bounds.width) * 100, 10, 100)),
      });
    };
    const finishAssetInteraction = () => {
      interactionRef.current = null;
    };
    window.addEventListener("pointermove", moveAsset, {passive: false});
    window.addEventListener("pointerup", finishAssetInteraction);
    window.addEventListener("pointercancel", finishAssetInteraction);
    return () => {
      window.removeEventListener("pointermove", moveAsset);
      window.removeEventListener("pointerup", finishAssetInteraction);
      window.removeEventListener("pointercancel", finishAssetInteraction);
    };
  }, [onAssetLayoutChange]);

  useEffect(() => {
    const moveText = (event: PointerEvent) => {
      const interaction = textInteractionRef.current;
      const stage = textStageRef.current;
      if (!interaction || !stage) return;
      if (event.cancelable) event.preventDefault();
      const bounds = stage.getBoundingClientRect();
      if (interaction.mode === "move") {
        const layout = {
          xOffsetPercent: roundPercentage(interaction.layout.xOffsetPercent + ((event.clientX - interaction.pointerX) / bounds.width) * 100),
          yOffsetPercent: roundPercentage(interaction.layout.yOffsetPercent + ((event.clientY - interaction.pointerY) / bounds.height) * 100),
        };
        if (interaction.blockId === null) onMainTextLayoutChange?.(layout);
        else onTextBlockLayoutChange?.(interaction.blockId, layout);
        return;
      }
      const style = {
        ...interaction.style,
        fontSize: Math.round(clamp((interaction.style.fontSize ?? 44) + ((event.clientX - interaction.pointerX) / bounds.width) * 100, 24, 120)),
      };
      if (interaction.blockId === null) onMainTextStyleChange?.(style);
      else onTextBlockStyleChange?.(interaction.blockId, style);
    };
    const finishTextInteraction = () => {
      textInteractionRef.current = null;
    };
    window.addEventListener("pointermove", moveText, {passive: false});
    window.addEventListener("pointerup", finishTextInteraction);
    window.addEventListener("pointercancel", finishTextInteraction);
    return () => {
      window.removeEventListener("pointermove", moveText);
      window.removeEventListener("pointerup", finishTextInteraction);
      window.removeEventListener("pointercancel", finishTextInteraction);
    };
  }, [onMainTextLayoutChange, onMainTextStyleChange, onTextBlockLayoutChange, onTextBlockStyleChange]);

  return (
    <AbsoluteFill style={{
      backgroundColor: palette.base,
      color: textColor,
      fontFamily: selectedFontFamily,
      overflow: "hidden",
    }}>
      {hasBackgroundImage ? (
        <>
          <Img
            src={project.theme.backgroundImage!.previewUrl}
            style={{position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover"}}
          />
          <AbsoluteFill style={{background: "rgba(3, 9, 14, 0.58)"}} />
        </>
      ) : (
        <>
          <AbsoluteFill style={{
            backgroundImage: `linear-gradient(${palette.grid} 1px, transparent 1px), linear-gradient(90deg, ${palette.grid} 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
            maskImage: "linear-gradient(to bottom, black 0%, transparent 92%)",
          }} />
          <ScienceMarks color={project.theme.accent} />
        </>
      )}
      <div style={{
        position: "absolute",
        inset: hasAssets ? "105px 82px 70px" : "100px 120px 100px",
        display: "flex",
        alignItems: "center",
        justifyContent: hasAssets ? "flex-start" : "center",
        flexDirection: "column",
        gap: hasAssets ? 24 : 18,
      }}>
        {textCount > 0 && (
          <div ref={textStageRef} style={{position: "relative", width: hasAssets ? "90%" : "84%", display: "flex", flexDirection: "column", alignItems: "center", gap: hasAssets ? 10 : 16, flexShrink: 0, overflow: "visible", touchAction: isEditable ? "none" : "auto"}}>
            {project.theme.showMainText && chunk.displayText.trim() && (
                <div
                  role={isEditable ? "group" : undefined}
                  aria-label={isEditable ? "表示テキストの位置と大きさを編集" : undefined}
                  onPointerDown={(event) => startMainTextInteraction(event, mainFontSize, "move")}
                  onClick={(event) => {
                    if (!isEditable) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onTextBlockSelect?.(MAIN_TEXT_ELEMENT_ID);
                  }}
                  style={{
                    position: "relative",
                    left: `${mainTextLayout.xOffsetPercent}%`,
                    top: `${mainTextLayout.yOffsetPercent}%`,
                    maxWidth: "100%",
                    outline: isMainTextSelected ? `4px solid ${project.theme.accent}` : "4px solid transparent",
                    outlineOffset: 8,
                    cursor: isEditable ? "grab" : "default",
                    willChange: isEditable ? "left, top" : undefined,
                  }}
                >
                  <LatexText
                    text={chunk.displayText}
                    style={{
                      display: "block",
                      maxWidth: "100%",
                      fontSize: mainFontSize,
                      fontFamily: selectedFontFamily,
                      color: selectedTextColor,
                      lineHeight: 1.48,
                      letterSpacing: "0.015em",
                      textAlign: "center",
                      fontWeight: 500,
                      textShadow: project.theme.background === "paper" && !hasBackgroundImage ? "none" : "0 3px 20px rgba(0,0,0,.5)",
                    }}
                  />
                  {isMainTextSelected ? (
                    <div
                      role="button"
                      tabIndex={0}
                      data-main-text-resize-handle
                      aria-label="表示テキストの文字サイズをドラッグで変更"
                      onPointerDown={(event) => startMainTextInteraction(event, mainFontSize, "resize")}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                        event.preventDefault();
                        event.stopPropagation();
                        onMainTextStyleChange?.({...chunk.textStyle, fontSize: clamp(mainFontSize + (event.key === "ArrowRight" ? 1 : -1), 24, 120)});
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      style={{position: "absolute", right: -26, top: -26, width: 44, height: 44, cursor: "nwse-resize", border: "4px solid white", borderRadius: 8, background: project.theme.accent, boxShadow: "0 8px 22px rgba(0,0,0,.32)"}}
                    />
                  ) : null}
                </div>
            )}
            {textBlocks.map((block) => {
              const fallbackFontSize = Math.round((chunk.textStyle?.fontSize ?? (hasAssets ? 46 : 58)) * 0.74);
              const blockStyle = {...chunk.textStyle, ...block.style};
              const blockLayout = block.layout ?? defaultTextBlockLayout();
              const isSelected = isEditable && editableTextBlockId === block.id;
              return (
                <div
                  key={block.id}
                  role={isEditable ? "group" : undefined}
                  aria-label={isEditable ? `${block.text}の位置と大きさを編集` : undefined}
                  onPointerDown={(event) => startTextInteraction(event, block, fallbackFontSize, "move")}
                  onClick={(event) => {
                    if (!isEditable) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onTextBlockSelect?.(block.id);
                  }}
                  style={{
                    position: "relative",
                    left: `${blockLayout.xOffsetPercent}%`,
                    top: `${blockLayout.yOffsetPercent}%`,
                    maxWidth: "100%",
                    outline: isSelected ? `4px solid ${project.theme.accent}` : "4px solid transparent",
                    outlineOffset: 8,
                    cursor: isEditable ? "grab" : "default",
                    willChange: isEditable ? "left, top" : undefined,
                  }}
                >
                  <LatexText
                    text={block.text}
                    style={{
                      display: "block",
                      maxWidth: "100%",
                      fontSize: blockStyle.fontSize ?? fallbackFontSize,
                      fontFamily: getVideoFontFamily(blockStyle.fontFamily),
                      lineHeight: 1.42,
                      textAlign: "center",
                      fontWeight: 400,
                      color: blockStyle.color ?? selectedTextColor,
                      opacity: 0.88,
                      textShadow: project.theme.background === "paper" && !hasBackgroundImage ? "none" : "0 2px 14px rgba(0,0,0,.45)",
                    }}
                  />
                  {isSelected ? (
                    <div
                      role="button"
                      tabIndex={0}
                      data-text-resize-handle
                      aria-label={`${block.text}の文字サイズをドラッグで変更`}
                      onPointerDown={(event) => startTextInteraction(event, block, fallbackFontSize, "resize")}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                        event.preventDefault();
                        event.stopPropagation();
                        onTextBlockStyleChange?.(block.id, {
                          ...blockStyle,
                          fontSize: clamp((blockStyle.fontSize ?? fallbackFontSize) + (event.key === "ArrowRight" ? 1 : -1), 24, 120),
                        });
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      style={{position: "absolute", right: -26, top: -26, width: 44, height: 44, cursor: "nwse-resize", border: "4px solid white", borderRadius: 8, background: project.theme.accent, boxShadow: "0 8px 22px rgba(0,0,0,.32)"}}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {hasAssets && (
          <div
            ref={imageStageRef}
            style={{position: "relative", flex: "1 1 0", minHeight: 0, width: "90%", overflow: "visible", touchAction: isEditable ? "none" : "auto"}}
            onClick={(event) => {
              if (!isEditable) return;
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {assets.map((asset, index) => {
              const layout = resolveImageLayout(asset, index, assets.length);
              const isSelected = isEditable && editableAssetIndex === index;
              return (
                <div
                  key={`${asset.previewUrl}-${index}`}
                  role={isEditable ? "group" : undefined}
                  aria-label={isEditable ? `${asset.name}の位置と大きさを編集` : undefined}
                  onPointerDown={(event) => startAssetInteraction(event, index, layout, "move")}
                  onClick={(event) => {
                    if (!isEditable) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onAssetSelect?.(index);
                  }}
                  style={{
                    position: "absolute",
                    left: `${layout.xPercent}%`,
                    top: `${layout.yPercent}%`,
                    width: `${layout.widthPercent}%`,
                    maxHeight: "100%",
                    transform: "translate(-50%, -50%)",
                    outline: isSelected ? `4px solid ${project.theme.accent}` : "4px solid transparent",
                    outlineOffset: 6,
                    cursor: isEditable ? "grab" : "default",
                    willChange: isEditable ? "transform" : undefined,
                  }}
                >
                  <Img
                    src={asset.previewUrl}
                    style={{display: "block", width: "100%", height: "auto", maxHeight: "100%", objectFit: "contain", borderRadius: 12, boxShadow: "0 20px 56px rgba(0,0,0,.28)", pointerEvents: "none"}}
                  />
                  {isSelected ? (
                    <div
                      role="button"
                      tabIndex={0}
                      data-resize-handle
                      aria-label={`${asset.name}の大きさをドラッグで変更`}
                      onPointerDown={(event) => startAssetInteraction(event, index, layout, "resize")}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                        event.preventDefault();
                        event.stopPropagation();
                        onAssetLayoutChange?.(index, {
                          ...layout,
                          widthPercent: clamp(layout.widthPercent + (event.key === "ArrowRight" ? 1 : -1), 10, 100),
                        });
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      style={{position: "absolute", right: 12, top: 12, width: 48, height: 48, cursor: "nwse-resize", border: "4px solid white", borderRadius: 8, background: project.theme.accent, boxShadow: "0 8px 22px rgba(0,0,0,.32)"}}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </AbsoluteFill>
  );
}

type LessonCompositionProps = {
  project: LessonProject;
  editableChunkId?: string;
  editableAssetIndex?: number;
  editableTextBlockId?: string;
  onAssetLayoutChange?: (index: number, layout: LessonImageLayout) => void;
  onAssetSelect?: (index: number) => void;
  onMainTextLayoutChange?: (layout: LessonTextLayout) => void;
  onMainTextStyleChange?: (style: LessonTextStyle) => void;
  onTextBlockLayoutChange?: (id: string, layout: LessonTextLayout) => void;
  onTextBlockSelect?: (id: string) => void;
  onTextBlockStyleChange?: (id: string, style: LessonTextStyle) => void;
};

export function LessonComposition({project, editableChunkId, editableAssetIndex, editableTextBlockId, onAssetLayoutChange, onAssetSelect, onMainTextLayoutChange, onMainTextStyleChange, onTextBlockLayoutChange, onTextBlockSelect, onTextBlockStyleChange}: LessonCompositionProps) {
  const sequences = project.chunks.reduce<Array<{chunk: LessonChunk; start: number; duration: number}>>((items, chunk) => {
    const previous = items.at(-1);
    const start = previous ? previous.start + previous.duration : 0;
    const duration = chunkDurationInFrames(chunk, project.gapInSeconds, project.fps);
    return [...items, {chunk, start, duration}];
  }, []);
  return (
    <AbsoluteFill>
      {project.backgroundMusic?.url ? (
        <Audio
          src={project.backgroundMusic.url}
          volume={project.backgroundMusic.volume}
          loop
          name="Background music"
        />
      ) : null}
      {sequences.map(({chunk, start, duration}) => (
          <Sequence key={chunk.id} from={start} durationInFrames={duration} premountFor={project.fps}>
            <Scene
              chunk={chunk}
              project={project}
              isEditable={chunk.id === editableChunkId}
              editableAssetIndex={editableAssetIndex}
              editableTextBlockId={editableTextBlockId}
              onAssetLayoutChange={onAssetLayoutChange}
              onAssetSelect={onAssetSelect}
              onMainTextLayoutChange={onMainTextLayoutChange}
              onMainTextStyleChange={onMainTextStyleChange}
              onTextBlockLayoutChange={onTextBlockLayoutChange}
              onTextBlockSelect={onTextBlockSelect}
              onTextBlockStyleChange={onTextBlockStyleChange}
            />
            {chunk.audio?.url ? <Audio src={chunk.audio.url} /> : null}
          </Sequence>
      ))}
    </AbsoluteFill>
  );
}
