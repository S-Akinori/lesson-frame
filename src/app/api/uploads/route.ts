import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {z} from "zod";
import {isD1Configured, queryProjects} from "@/lib/d1";
import {createReadUrl, createUploadUrl, isR2Configured} from "@/lib/r2";

export const runtime = "nodejs";

const schema = z.object({
  projectId: z.string().min(1).max(100),
  fileName: z.string().min(1).max(180),
  contentType: z.enum([
    "image/png", "image/jpeg", "image/webp",
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/vnd.wav",
    "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "application/ogg",
  ]),
  size: z.number().int().positive().max(50 * 1024 * 1024),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

type AssetRow = {
  id: string;
  name: string;
  kind: "image" | "audio";
  mime_type: string;
  storage_key: string;
  content_hash: string | null;
  created_at: string;
};

export async function POST(request: Request) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json({ok: false, error: "R2が未設定です。"}, {status: 503});
    }
    const input = schema.parse(await request.json());
    if (input.contentHash && isD1Configured()) {
      try {
        const existing = (await queryProjects<AssetRow>(
          "SELECT id, name, kind, mime_type, storage_key, content_hash, created_at FROM lesson_assets WHERE content_hash = ?1 LIMIT 1",
          [input.contentHash],
        ))[0];
        if (existing) {
          return NextResponse.json({
            ok: true,
            duplicate: true,
            key: existing.storage_key,
            readUrl: await createReadUrl(existing.storage_key, 60 * 60 * 12),
            asset: {
              id: existing.id,
              name: existing.name,
              kind: existing.kind,
              mimeType: existing.mime_type,
              storageKey: existing.storage_key,
              contentHash: existing.content_hash ?? undefined,
              createdAt: existing.created_at,
            },
          });
        }
      } catch {
        // D1の照合に失敗しても、素材のアップロード自体は継続します。
      }
    }
    const extension = input.contentType.split("/")[1]
      .replace("jpeg", "jpg")
      .replace("x-wav", "wav")
      .replace("vnd.wav", "wav")
      .replace("mpeg", "mp3")
      .replace("x-m4a", "m4a");
    const key = input.contentHash
      ? `library/by-hash/${input.contentHash}.${extension}`
      : `projects/${input.projectId}/assets/${randomUUID()}.${extension}`;
    return NextResponse.json({
      ok: true,
      key,
      uploadUrl: await createUploadUrl(key, input.contentType),
      readUrl: await createReadUrl(key, 60 * 60 * 12),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "アップロードURLを発行できませんでした。";
    return NextResponse.json({ok: false, error: message}, {status: 400});
  }
}
