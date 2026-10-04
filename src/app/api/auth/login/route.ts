import {NextResponse} from "next/server";
import {
  createSiteSessionToken,
  getSitePassword,
  SITE_AUTH_COOKIE,
  SITE_AUTH_MAX_AGE_SECONDS,
  verifySitePassword,
} from "@/lib/site-auth";

const safeReturnPath = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
};

const loginRedirect = (request: Request, params: Record<string, string>) => {
  const url = new URL("/login", request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url, 303);
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const returnPath = safeReturnPath(formData.get("next"));
  const configuredPassword = getSitePassword();

  if (!configuredPassword) {
    return loginRedirect(request, {setup: "required", next: returnPath});
  }

  const candidate = formData.get("password");
  if (typeof candidate !== "string" || !(await verifySitePassword(candidate))) {
    return loginRedirect(request, {error: "invalid", next: returnPath});
  }

  const response = NextResponse.redirect(new URL(returnPath, request.url), 303);
  response.cookies.set({
    name: SITE_AUTH_COOKIE,
    value: await createSiteSessionToken(configuredPassword),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SITE_AUTH_MAX_AGE_SECONDS,
    priority: "high",
  });
  return response;
}
