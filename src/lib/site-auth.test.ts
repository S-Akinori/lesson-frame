import {afterEach, describe, expect, it, vi} from "vitest";
import {createSiteSessionToken, isSitePasswordConfigured, verifySitePassword, verifySiteSession} from "./site-auth";

describe("site authentication", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when SITE_PASSWORD is missing", async () => {
    vi.stubEnv("SITE_PASSWORD", "");
    expect(isSitePasswordConfigured()).toBe(false);
    expect(await verifySitePassword("anything")).toBe(false);
    expect(await verifySiteSession("anything")).toBe(false);
  });

  it("accepts only the configured password and its session token", async () => {
    vi.stubEnv("SITE_PASSWORD", "private-studio-passphrase");
    const token = await createSiteSessionToken("private-studio-passphrase");
    expect(await verifySitePassword("private-studio-passphrase")).toBe(true);
    expect(await verifySitePassword("wrong-password")).toBe(false);
    expect(await verifySiteSession(token)).toBe(true);
    expect(await verifySiteSession(await createSiteSessionToken("old-password"))).toBe(false);
  });
});
