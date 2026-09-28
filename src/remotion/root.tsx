import {Composition} from "remotion";
import {LessonComposition} from "../components/video/lesson-composition";
import type {LessonProject} from "../lib/types";

const defaultProject: LessonProject = {
  id: "demo",
  title: "気体の状態方程式",
  fps: 30,
  width: 1920,
  height: 1080,
  gapInSeconds: 0.15,
  voice: "Kore",
  voiceStyle: "テンポよく、落ち着いたトーンで親しみやすい口調で解説する。",
  theme: {background: "blueprint", accent: "#d46b52", showMainText: true},
  chunks: [{
    id: "demo-1",
    order: 0,
    displayText: "状態方程式は $PV=nRT$ です。",
    speechText: "状態方程式は、ピー ブイ イコール エヌ アール ティーです。",
    durationInSeconds: 5,
    status: "draft",
  }],
};

export function RemotionRoot() {
  return (
    <Composition
      id="LessonVideo"
      component={LessonComposition}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={150}
      defaultProps={{project: defaultProject}}
      calculateMetadata={({props}) => ({
        durationInFrames: Math.max(1, Math.ceil(props.project.chunks.reduce(
          (sum, chunk) => sum + chunk.durationInSeconds + props.project.gapInSeconds,
          0,
        ) * props.project.fps)),
        fps: props.project.fps,
        width: props.project.width,
        height: props.project.height,
      })}
    />
  );
}
