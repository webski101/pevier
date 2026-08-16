import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGoogleAuthorizationUrl, GOOGLE_AUTH_SCOPES, isGoogleAuthConfigured } from "../lib/google-auth";

describe("Google identity boundary", () => {
  const clearGoogleEnvironment = () => {
    delete process.env.GOOGLE_AUTH_CLIENT_ID;
    delete process.env.GOOGLE_AUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_AUTH_REDIRECT_URI;
  };

  beforeEach(clearGoogleEnvironment);
  afterEach(clearGoogleEnvironment);

  it("requires a dedicated client id and secret", () => {
    process.env.GOOGLE_AUTH_CLIENT_ID = "identity-client";
    expect(isGoogleAuthConfigured()).toBe(false);
    process.env.GOOGLE_AUTH_CLIENT_SECRET = "identity-secret";
    expect(isGoogleAuthConfigured()).toBe(true);
  });

  it("requests only basic identity scopes and no YouTube access", () => {
    process.env.GOOGLE_AUTH_CLIENT_ID = "identity-client";
    process.env.GOOGLE_AUTH_CLIENT_SECRET = "identity-secret";

    const url = createGoogleAuthorizationUrl("https://pevier.example", "secure-state");
    const scopes = url.searchParams.get("scope")?.split(" ") ?? [];

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("state")).toBe("secure-state");
    expect(url.searchParams.get("redirect_uri")).toBe("https://pevier.example/api/auth/google/callback");
    expect(scopes).toEqual([...GOOGLE_AUTH_SCOPES]);
    expect(scopes.some((scope) => scope.includes("youtube"))).toBe(false);
  });
});
