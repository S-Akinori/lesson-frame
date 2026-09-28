import {describe, expect, it} from "vitest";
import {prepareProjectForDatabase} from "@/lib/project-persistence";
import type {LessonProject} from "@/lib/types";

const project: LessonProject = {
  id: "project-db-test",
  title: "DB保存テスト",
  fps: 30,
  width: 1920,
  height: 1080,
  gapInSeconds: 0.15,
  voice: "Kore",
  voiceStyle: "落ち着いて読む",
  backgroundMusic: {name: "local.mp3", url: "data:audio/mpeg;base64,AAAA", mimeType: "audio/mpeg", volume: 0.2},
  theme: {
    background: "blueprint",
    accent: "#c45d45",
    showMainText: true,
    backgroundImage: {name: "local.png", previewUrl: "blob:local-background"},
  },
  chunks: [{
    id: "chunk-1",
    order: 0,
    displayText: "テスト",
    speechText: "テスト",
    durationInSeconds: 2,
    status: "draft",
    assets: [
      {name: "local.png", previewUrl: "data:image/png;base64,AAAA"},
      {name: "remote.png", previewUrl: "https://example.com/remote.png", storageKey: "projects/p/assets/remote.png"},
    ],
    audio: {url: "data:audio/wav;base64,AAAA", mimeType: "audio/wav"},
  }],
};

describe("database project persistence", () => {
  it("keeps project data and R2 media references while omitting browser-only media", () => {
    const result = prepareProjectForDatabase(project);
    expect(result.omittedMediaCount).toBe(4);
    expect(result.project.backgroundMusic).toBeUndefined();
    expect(result.project.theme.backgroundImage).toBeUndefined();
    expect(result.project.chunks[0].audio).toBeUndefined();
    expect(result.project.chunks[0].assets).toEqual([project.chunks[0].assets?.[1]]);
  });
});
