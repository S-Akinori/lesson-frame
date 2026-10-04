import {NextResponse} from "next/server";

export const runtime = "nodejs";
export async function POST() {
  return NextResponse.json({
    ok: false,
    error: "MP4書き出しはブラウザ内レンダリングへ移行しました。画面の「MP4を書き出す」を使用してください。",
  }, {status: 410});
}
