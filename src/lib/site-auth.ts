const encoder = new TextEncoder();

export const SITE_AUTH_COOKIE = "lesson_frame_access";
export const SITE_AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const getSitePassword = () => process.env.SITE_PASSWORD?.trim() ?? "";

export const isSitePasswordConfigured = () => getSitePassword().length > 0;

const digest = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(`lesson-frame:v1:${value}`));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const constantTimeEqual = (left: string, right: string) => {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
};

export const createSiteSessionToken = (password: string) => digest(password);

export const verifySitePassword = async (candidate: string) => {
  const password = getSitePassword();
  if (!password) return false;
  return constantTimeEqual(await digest(candidate), await digest(password));
};

export const verifySiteSession = async (token: string | undefined) => {
  const password = getSitePassword();
  if (!password || !token) return false;
  return constantTimeEqual(token, await createSiteSessionToken(password));
};
