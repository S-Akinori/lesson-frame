import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {z} from "zod";
import {isD1Configured, queryProjects} from "@/lib/d1";
import {createReadUrl, isR2Configured} from "@/lib/r2";
import type {ReusableAsset} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const assetInputSchema = z.object({
  name: z.string().min(1).max(180),
  kind: z.enum(["image", "audio"]),
  mimeType: z.string().min(1).max(100),
  url: z.string().min(1),
  storageKey: z.string().min(1).max(500),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

type AssetRow = {
  id: string;
  name: string;
  kind: "image" | "audio";
  mime_type: string;
  source_url: string;
  storage_key: string;
  content_hash: string | null;
  created_at: string;
};

const toAsset = async (row: AssetRow): Promise<ReusableAsset> => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  mimeType: row.mime_type,
  storageKey: row.storage_key,
  contentHash: row.content_hash ?? undefined,
  url: isR2Configured() ? await createReadUrl(row.storage_key, 60 * 60 * 12) : row.source_url,
  createdAt: row.created_at,
});

export async function GET() {
  try {
    if (!isD1Configured()) return NextResponse.json({ok: false, error: "Cloudflare D1が未設定です。"}, {status: 503});
    const rows = await queryProjects<AssetRow>("SELECT * FROM lesson_assets ORDER BY updated_at DESC");
    return NextResponse.json({ok: true, assets: await Promise.all(rows.map(toAsset))});
  } catch (error) {
    return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "素材ライブラリを読み込めませんでした。"}, {status: 500});
  }
}

export async function POST(request: Request) {
  try {
    if (!isD1Configured()) return NextResponse.json({ok: false, error: "Cloudflare D1が未設定です。"}, {status: 503});
    const input = assetInputSchema.parse(await request.json());
    if (input.contentHash) {
      const duplicates = await queryProjects<AssetRow>("SELECT * FROM lesson_assets WHERE content_hash = ?1 LIMIT 1", [input.contentHash]);
      if (duplicates[0]) return NextResponse.json({ok: true, asset: await toAsset(duplicates[0]), duplicate: true});
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    await queryProjects(
      `INSERT INTO lesson_assets (id, name, kind, mime_type, storage_key, content_hash, source_url, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
       ON CONFLICT(storage_key) DO UPDATE SET
         name = excluded.name,
         kind = excluded.kind,
         mime_type = excluded.mime_type,
         content_hash = COALESCE(excluded.content_hash, lesson_assets.content_hash),
         source_url = excluded.source_url,
         updated_at = excluded.updated_at`,
      [id, input.name, input.kind, input.mimeType, input.storageKey, input.contentHash ?? null, input.url, now],
    );
    const rows = await queryProjects<AssetRow>("SELECT * FROM lesson_assets WHERE storage_key = ?1", [input.storageKey]);
    const saved = rows[0];
    if (!saved) throw new Error("保存した素材を読み込めませんでした。");
    return NextResponse.json({ok: true, asset: await toAsset(saved)});
  } catch (error) {
    return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "素材を登録できませんでした。"}, {status: 400});
  }
}
