import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {z} from "zod";
import {isD1Configured, queryProjects} from "@/lib/d1";
import {hydrateProjectMediaUrls} from "@/lib/project-media";
import {projectSchema} from "@/lib/project-schema";
import type {ProjectTemplate} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  voice: z.string().min(1).max(80),
  voiceStyle: z.string().max(300),
  backgroundMusic: projectSchema.shape.backgroundMusic.optional(),
  chunks: projectSchema.shape.chunks,
});

type TemplateRow = {template_json: string};

const hydrateTemplate = async (template: ProjectTemplate): Promise<ProjectTemplate> => {
  const shell = projectSchema.parse({
    id: `template-${template.id}`,
    title: template.name,
    fps: 30,
    width: 1920,
    height: 1080,
    gapInSeconds: 0.15,
    voice: template.voice,
    voiceStyle: template.voiceStyle,
    backgroundMusic: template.backgroundMusic,
    theme: {background: "blueprint", accent: "#c45d45", showMainText: true},
    chunks: template.chunks,
  });
  const hydrated = await hydrateProjectMediaUrls(shell);
  return {...template, backgroundMusic: hydrated.backgroundMusic};
};

export async function GET() {
  try {
    if (!isD1Configured()) return NextResponse.json({ok: false, error: "Cloudflare D1が未設定です。"}, {status: 503});
    const rows = await queryProjects<TemplateRow>("SELECT template_json FROM lesson_templates ORDER BY updated_at DESC");
    const templates = await Promise.all(rows.map((row) => hydrateTemplate(templateSchema.parse(JSON.parse(row.template_json)) as ProjectTemplate)));
    return NextResponse.json({ok: true, templates});
  } catch (error) {
    return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "テンプレートを読み込めませんでした。"}, {status: 500});
  }
}

export async function POST(request: Request) {
  try {
    if (!isD1Configured()) return NextResponse.json({ok: false, error: "Cloudflare D1が未設定です。"}, {status: 503});
    const input = templateSchema.parse(await request.json());
    const id = input.id ?? randomUUID();
    const template: ProjectTemplate = {...input, id};
    const now = new Date().toISOString();
    await queryProjects(
      `INSERT INTO lesson_templates (id, name, template_json, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?4)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, template_json = excluded.template_json, updated_at = excluded.updated_at`,
      [id, template.name, JSON.stringify(template), now],
    );
    return NextResponse.json({ok: true, template});
  } catch (error) {
    return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "テンプレートを保存できませんでした。"}, {status: 400});
  }
}
