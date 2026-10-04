import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";
import {SITE_AUTH_COOKIE, verifySiteSession} from "@/lib/site-auth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

export async function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();

  const token = request.cookies.get(SITE_AUTH_COOKIE)?.value;
  if (await verifySiteSession(token)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (returnPath !== "/") loginUrl.searchParams.set("next", returnPath);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|robots.txt).*)"],
};
