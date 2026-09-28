import {NextResponse} from "next/server";
import {isD1Configured, queryProjects} from "@/lib/d1";
import {hydrateProjectMediaUrls} from "@/lib/project-media";
import {prepareProjectForDatabase} from "@/lib/project-persistence";
import {projectSchema} from "@/lib/project-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProjectRow = {project_json: string};

export async function GET() {
  try {
    if (!isD1Configured()) {
      return NextResponse.json({ok: false, error: "Cloudflare D1が未設定です。"}, {status: 503});
    }
    const rows = await queryProjects<ProjectRow>("SELECT project_json FROM lesson_projects ORDER BY updated_at DESC");
    const projects = await Promise.all(rows.map(async (row) => (
      hydrateProjectMediaUrls(projectSchema.parse(JSON.parse(row.project_json)))
    )));
    return NextResponse.json({ok: true, projects});
  } catch (error) {
    return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "プロジェクトを読み込めませんでした。"}, {status: 500});
  }
}

export async function POST(request: Request) {
  try {
    if (!isD1Configured()) {
      return NextResponse.json({ok: false, error: "Cloudflare D1が未設定です。"}, {status: 503});
    }
    const input = projectSchema.parse(await request.json());
    const {project, omittedMediaCount} = prepareProjectForDatabase(input);
    const now = new Date().toISOString();
    await queryProjects(
      `INSERT INTO lesson_projects (id, title, project_json, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?4)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         project_json = excluded.project_json,
         updated_at = excluded.updated_at`,
      [project.id, project.title, JSON.stringify(project), now],
    );
    return NextResponse.json({
      ok: true,
      project,
      warning: omittedMediaCount > 0
        ? `${omittedMediaCount}件のブラウザ内素材はDB保存から除外しました。別端末で使うにはR2設定が必要です。`
        : undefined,
    });
  } catch (error) {
    return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "プロジェクトを保存できませんでした。"}, {status: 400});
  }
}
