import "katex/dist/katex.min.css";
import {AbsoluteFill, Audio, Img, Sequence} from "remotion";
import type {LessonChunk, LessonProject} from "../../lib/types";
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

function Scene({chunk, project}: {chunk: LessonChunk; project: LessonProject}) {
  const palette = backgrounds[project.theme.background];
  const assets = [...(chunk.asset ? [chunk.asset] : []), ...(chunk.assets ?? [])].filter((asset) => asset.previewUrl);
  const textBlocks = (chunk.textBlocks ?? []).filter((block) => block.text.trim());
  const hasAssets = assets.length > 0;
  const textCount = (project.theme.showMainText && chunk.displayText.trim() ? 1 : 0) + textBlocks.length;
  const hasBackgroundImage = Boolean(project.theme.backgroundImage?.previewUrl);
  const textColor = hasBackgroundImage ? "#ffffff" : palette.text;
  const imageColumns = assets.length === 1 ? 1 : assets.length <= 4 ? 2 : 3;

  return (
    <AbsoluteFill style={{
      backgroundColor: palette.base,
      color: textColor,
      fontFamily: '"Noto Sans JP", "Yu Gothic", sans-serif',
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
      <div style={{position: "absolute", top: 54, left: 72, fontSize: 22, letterSpacing: "0.18em", color: hasBackgroundImage ? "rgba(255,255,255,.78)" : palette.muted, opacity: 0.7}}>
        LESSON / {String(chunk.order + 1).padStart(2, "0")}
      </div>

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
          <div style={{width: hasAssets ? "90%" : "84%", display: "flex", flexDirection: "column", alignItems: "center", gap: hasAssets ? 10 : 16, flexShrink: 0}}>
            {project.theme.showMainText && chunk.displayText.trim() && (
              <LatexText
                text={chunk.displayText}
                style={{
                  display: "block",
                  maxWidth: "100%",
                  fontSize: displayFontSize(chunk.displayText, hasAssets, textCount),
                  lineHeight: 1.48,
                  letterSpacing: "0.015em",
                  textAlign: "center",
                  fontWeight: 500,
                  textShadow: project.theme.background === "paper" && !hasBackgroundImage ? "none" : "0 3px 20px rgba(0,0,0,.5)",
                }}
              />
            )}
            {textBlocks.map((block) => (
              <LatexText
                key={block.id}
                text={block.text}
                style={{
                  display: "block",
                  maxWidth: "100%",
                  fontSize: hasAssets ? 34 : 44,
                  lineHeight: 1.42,
                  textAlign: "center",
                  fontWeight: 400,
                  color: hasBackgroundImage ? "rgba(255,255,255,.9)" : palette.muted,
                  textShadow: project.theme.background === "paper" && !hasBackgroundImage ? "none" : "0 2px 14px rgba(0,0,0,.45)",
                }}
              />
            ))}
          </div>
        )}
        {hasAssets && (
          <div style={{flex: "1 1 0", minHeight: 0, width: "90%", display: "grid", gridTemplateColumns: `repeat(${imageColumns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${Math.ceil(assets.length / imageColumns)}, minmax(0, 1fr))`, gap: 18}}>
            {assets.map((asset, index) => (
              <div key={`${asset.previewUrl}-${index}`} style={{minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"}}>
                <Img
                  src={asset.previewUrl}
                  style={{maxHeight: "100%", maxWidth: "100%", objectFit: "contain", borderRadius: 12, boxShadow: "0 20px 56px rgba(0,0,0,.28)"}}
                />
              </div>
            ))}
          </div>
        )}
      </div>

    </AbsoluteFill>
  );
}

export function LessonComposition({project}: {project: LessonProject}) {
  const sequences = project.chunks.reduce<Array<{chunk: LessonChunk; start: number; duration: number}>>((items, chunk) => {
    const previous = items.at(-1);
    const start = previous ? previous.start + previous.duration : 0;
    const duration = Math.max(1, Math.ceil((chunk.durationInSeconds + project.gapInSeconds) * project.fps));
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
            <Scene chunk={chunk} project={project} />
            {chunk.audio?.url ? <Audio src={chunk.audio.url} /> : null}
          </Sequence>
      ))}
    </AbsoluteFill>
  );
}
