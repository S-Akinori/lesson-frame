import type {LessonImage, LessonProject} from "@/lib/types";

const isEphemeralUrl = (url: string) => url.startsWith("data:") || url.startsWith("blob:");

const persistentImage = (image?: LessonImage) => (
  image && (!isEphemeralUrl(image.previewUrl) || image.storageKey) ? image : undefined
);

const persistentAudio = <T extends {url: string; storageKey?: string}>(audio?: T) => (
  audio && (!isEphemeralUrl(audio.url) || audio.storageKey) ? audio : undefined
);

export const prepareProjectForDatabase = (project: LessonProject) => {
  let omittedMediaCount = 0;
  const keepImage = (image?: LessonImage) => {
    const persisted = persistentImage(image);
    if (image && !persisted) omittedMediaCount += 1;
    return persisted;
  };
  const keepAudio = <T extends {url: string; storageKey?: string}>(audio?: T) => {
    const persisted = persistentAudio(audio);
    if (audio && !persisted) omittedMediaCount += 1;
    return persisted;
  };

  const backgroundMusic = keepAudio(project.backgroundMusic);

  return {
    project: {
      ...project,
      backgroundMusic,
      theme: {...project.theme, backgroundImage: keepImage(project.theme.backgroundImage)},
      chunks: project.chunks.map((chunk) => ({
        ...chunk,
        asset: keepImage(chunk.asset),
        assets: chunk.assets?.map((asset) => keepImage(asset)).filter((asset): asset is LessonImage => Boolean(asset)),
        audio: keepAudio(chunk.audio),
      })),
    },
    omittedMediaCount,
  };
};
