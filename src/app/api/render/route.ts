import {readFile, unlink} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {randomUUID} from "node:crypto";
import {bundle} from "@remotion/bundler";
import {renderMedia, selectComposition} from "@remotion/renderer";
import {NextResponse} from "next/server";
import {hydrateProjectMediaUrls} from "@/lib/project-media";
import {projectSchema} from "@/lib/project-schema";

export const runtime = "nodejs";
export const maxDuration = 800;

declare global {
  var __lessonFrameBundle: Promise<string> | undefined;
}

const getBundle = () => {
  const createBundle = () => bundle({
    entryPoint: path.join(process.cwd(), "src", "remotion", "index.ts"),
    webpackOverride: (config) => config,
  });
  if (process.env.NODE_ENV !== "production") return createBundle();
  if (!globalThis.__lessonFrameBundle) {
    globalThis.__lessonFrameBundle = createBundle().catch((error) => {
      globalThis.__lessonFrameBundle = undefined;
      throw error;
    });
  }
  return globalThis.__lessonFrameBundle;
};

export async function POST(request: Request) {
  let outputLocation: string | undefined;
  try {
    const parsed = projectSchema.parse(await request.json());
    const project = await hydrateProjectMediaUrls(parsed);
    const renderId = randomUUID();
    outputLocation = path.join(os.tmpdir(), `lesson-frame-${renderId}.mp4`);
    const serveUrl = await getBundle();
    const inputProps = {project};
    const composition = await selectComposition({serveUrl, id: "LessonVideo", inputProps});

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      audioCodec: "aac",
      pixelFormat: "yuv420p",
      outputLocation,
      inputProps,
      concurrency: 2,
      chromiumOptions: {enableMultiProcessOnLinux: true},
    });

    const video = await readFile(/* turbopackIgnore: true */ outputLocation);
    const safeTitle = project.title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "lesson-frame";
    return new Response(new Uint8Array(video), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(video.byteLength),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeTitle}.mp4`)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "レンダリングに失敗しました。";
    return NextResponse.json({ok: false, error: message}, {status: 400});
  } finally {
    if (outputLocation) await unlink(outputLocation).catch(() => undefined);
  }
}
