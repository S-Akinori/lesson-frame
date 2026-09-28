import {createReadUrl, isR2Configured} from "@/lib/r2";
import type {LessonProject} from "@/lib/types";

export const hydrateProjectMediaUrls = async (project: LessonProject): Promise<LessonProject> => {
  if (!isR2Configured()) return project;
  const refresh = async <T extends {storageKey?: string}>(media: T, urlKey: "url" | "previewUrl") => ({
    ...media,
    [urlKey]: media.storageKey ? await createReadUrl(media.storageKey, 60 * 60 * 12) : media[urlKey as keyof T],
  });

  const [backgroundImage, backgroundMusic, chunks] = await Promise.all([
    project.theme.backgroundImage ? refresh(project.theme.backgroundImage, "previewUrl") : undefined,
    project.backgroundMusic ? refresh(project.backgroundMusic, "url") : undefined,
    Promise.all(project.chunks.map(async (chunk) => ({
      ...chunk,
      asset: chunk.asset ? await refresh(chunk.asset, "previewUrl") : undefined,
      assets: chunk.assets ? await Promise.all(chunk.assets.map((asset) => refresh(asset, "previewUrl"))) : undefined,
      audio: chunk.audio ? await refresh(chunk.audio, "url") : undefined,
    }))),
  ]);
  return {...project, backgroundMusic, theme: {...project.theme, backgroundImage}, chunks};
};
