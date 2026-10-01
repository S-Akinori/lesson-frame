import {describe, expect, it} from "vitest";
import {
  parseProjectFile,
  projectFileErrorMessage,
  projectFileName,
  serializeProjectFile,
} from "@/lib/project-file";
import type {LessonProject} from "@/lib/types";

const project: LessonProject = {
  id: "project-1",
  title: "気体の状態方程式",
  fps: 30,
  width: 1920,
  height: 1080,
  gapInSeconds: 0.15,
  voice: "Kore",
  voiceStyle: "落ち着いて読み上げる",
  backgroundMusic: {
    name: "study-theme.mp3",
    url: "https://example.com/study-theme.mp3",
    storageKey: "projects/project-1/assets/study-theme.mp3",
    mimeType: "audio/mpeg",
    volume: 0.2,
  },
  theme: {
    background: "blueprint",
    backgroundImage: {
      name: "classroom.webp",
      previewUrl: "https://example.com/classroom.webp",
      storageKey: "projects/project-1/assets/classroom.webp",
    },
    accent: "#c45d45",
    showMainText: true,
  },
  chunks: [{
    id: "chunk-1",
    order: 0,
    displayText: "状態方程式は $PV=nRT$ です。",
    textLayout: {xOffsetPercent: 184, yOffsetPercent: -236},
    speechText: "状態方程式は、ピー ブイ イコール エヌ アール ティーです。",
    voice: "Charon",
    voiceStyle: "式をゆっくり強調して読む",
    durationInSeconds: 4,
    status: "draft",
    textBlocks: [{id: "text-1", text: "補足：$R$ は気体定数です。", layout: {xOffsetPercent: -420, yOffsetPercent: 315}}],
    assets: [
      {name: "graph.webp", previewUrl: "https://example.com/graph.webp"},
      {name: "formula.webp", previewUrl: "https://example.com/formula.webp"},
    ],
  }],
};

describe("project file", () => {
  it("serializes Remotion input props and reads them back", () => {
    const json = serializeProjectFile(project);
    expect(JSON.parse(json)).toEqual({project});
    expect(parseProjectFile(JSON.parse(json))).toEqual(project);
  });

  it("accepts legacy raw project JSON", () => {
    expect(parseProjectFile(project)).toEqual(project);
  });

  it("accepts incomplete chunks so draft projects can still be rendered", () => {
    const incomplete = {
      ...project,
      chunks: [{
        ...project.chunks[0],
        displayText: "",
        speechText: "",
        textBlocks: [{id: "empty-note", text: ""}],
        audio: undefined,
        assets: undefined,
      }],
    };
    expect(parseProjectFile(incomplete)).toEqual(incomplete);
  });

  it("rejects an invalid project with a readable message", () => {
    try {
      parseProjectFile({project: {...project, fps: 10}});
      throw new Error("Expected parsing to fail");
    } catch (error) {
      expect(projectFileErrorMessage(error)).toContain("fps");
    }
  });

  it("creates a filesystem-safe filename", () => {
    expect(projectFileName("物理: 第1回 / 状態方程式")).toBe("物理- 第1回 - 状態方程式.remotion.json");
    expect(projectFileName("   ")).toBe("lesson-frame-project.remotion.json");
  });
});
