import {ZodError} from "zod";
import {projectSchema} from "@/lib/project-schema";
import type {LessonProject} from "@/lib/types";

export type RemotionProjectFile = {
  project: LessonProject;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

export const parseProjectFile = (value: unknown): LessonProject => {
  const candidate = isRecord(value) && "project" in value ? value.project : value;
  return projectSchema.parse(candidate);
};

export const serializeProjectFile = (project: LessonProject) => (
  JSON.stringify({project} satisfies RemotionProjectFile, null, 2)
);

export const projectFileName = (title: string) => {
  const safeTitle = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 80);
  return `${safeTitle || "lesson-frame-project"}.remotion.json`;
};

export const projectFileErrorMessage = (error: unknown) => {
  if (error instanceof SyntaxError) {
    return "JSONの構文が正しくありません。ファイルが途中で壊れていないか確認してください。";
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "project";
    return `Remotionプロジェクトの形式が正しくありません（${path}: ${issue?.message ?? "不明な値"}）。`;
  }
  return error instanceof Error ? error.message : "JSONファイルを読み込めませんでした。";
};
