import {NextResponse} from "next/server";
import {isD1Configured, queryProjects} from "@/lib/d1";

export const runtime = "nodejs";

export async function DELETE(_request: Request, {params}: RouteContext<"/api/projects/[id]">) {
  try {
    if (!isD1Configured()) {
      return NextResponse.json({ok: false, error: "Cloudflare D1が未設定です。"}, {status: 503});
    }
    const {id} = await params;
    await queryProjects("DELETE FROM lesson_projects WHERE id = ?1", [id]);
    return NextResponse.json({ok: true});
  } catch (error) {
    return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "プロジェクトを削除できませんでした。"}, {status: 400});
  }
}
