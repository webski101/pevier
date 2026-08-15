import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret } from "../lib/secret-vault";
import { createPrivateYouTubeUpload, createYouTubeAuthorizationUrl } from "../lib/youtube";

describe("YouTube adapter safety", () => {
  beforeEach(() => {
    process.env.PEVIER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.PEVIER_ENCRYPTION_KEY;
  });

  it("requests upload and channel identity permissions", () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    const url = createYouTubeAuthorizationUrl("http://localhost:3000", "oauth-state");
    const scopes = url.searchParams.get("scope")?.split(" ") ?? [];

    expect(scopes).toEqual(expect.arrayContaining(["openid", "email", "profile"]));
    expect(scopes).toContain("https://www.googleapis.com/auth/youtube.upload");
    expect(scopes).toContain("https://www.googleapis.com/auth/youtube.readonly");
  });

  it("encrypts stored OAuth credentials", () => {
    const encrypted = encryptSecret("refresh-token-secret");
    expect(encrypted).not.toContain("refresh-token-secret");
    expect(decryptSecret(encrypted)).toBe("refresh-token-secret");
  });

  it("forces live YouTube uploads to private", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { location: "https://upload.youtube.test/session" } }))
      .mockResolvedValueOnce(Response.json({ id: "video-private-123" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPrivateYouTubeUpload(
      "access-token",
      { bytes: new Uint8Array([1, 2, 3]), mimeType: "video/mp4" },
      { title: "Policy-safe private test", description: "Reviewed by Pevier" },
    );

    expect(result).toEqual({ id: "video-private-123", privacyStatus: "private" });
    const startRequest = fetchMock.mock.calls[0];
    const metadata = JSON.parse(startRequest[1].body);
    expect(metadata.status.privacyStatus).toBe("private");
    expect(fetchMock.mock.calls[1][0]).toBe("https://upload.youtube.test/session");
  });
});
