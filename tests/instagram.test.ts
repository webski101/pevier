import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstagramAdapter } from "../lib/adapters";
import { createInstagramAuthorizationUrl, getInstagramStatus, isInstagramConfigured } from "../lib/instagram";

describe("Instagram connection safety", () => {
  const clearInstagramEnvironment = () => {
    vi.unstubAllGlobals();
    delete process.env.INSTAGRAM_APP_ID;
    delete process.env.INSTAGRAM_APP_SECRET;
    delete process.env.INSTAGRAM_REDIRECT_URI;
    delete process.env.INSTAGRAM_API_VERSION;
    delete process.env.PEVIER_ENCRYPTION_KEY;
  };

  beforeEach(clearInstagramEnvironment);
  afterEach(clearInstagramEnvironment);

  it("stays signed out and makes no Meta request without a Pevier user", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const status = await getInstagramStatus();

    expect(status).toMatchObject({ configured: false, connected: false, authenticated: false, status: "SIGNED_OUT", mode: "DRY_RUN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires app id, app secret, and the shared encryption key", () => {
    process.env.INSTAGRAM_APP_ID = "app-123";
    process.env.INSTAGRAM_APP_SECRET = "secret-456";
    expect(isInstagramConfigured()).toBe(false);
    process.env.PEVIER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(isInstagramConfigured()).toBe(true);
  });

  it("creates a state-bound Instagram Login URL with only publishing scopes", () => {
    process.env.INSTAGRAM_APP_ID = "app-123";
    process.env.INSTAGRAM_APP_SECRET = "secret-456";
    process.env.PEVIER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

    const url = createInstagramAuthorizationUrl("https://pevier.example", "oauth-state");

    expect(url.origin).toBe("https://www.instagram.com");
    expect(url.searchParams.get("state")).toBe("oauth-state");
    expect(url.searchParams.get("redirect_uri")).toBe("https://pevier.example/api/platforms/instagram/callback");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_content_publish");
  });

  it("never calls Instagram while the publishing adapter is in dry run", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await new InstagramAdapter("DRY_RUN").publish({
      agentId: "agent-1", channelId: "instagram-1", platform: "instagram", title: "Dry run", contentText: "Policy-safe simulation content.",
    });
    expect(result).toEqual({ published: false, mode: "DRY_RUN", reason: "DRY_RUN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires explicit public confirmation before any live Meta request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await new InstagramAdapter("LIVE").publish({
      agentId: "agent-1", channelId: "instagram-1", platform: "instagram", title: "Public Reel", contentText: "Reviewed public Reel.",
    }, { instagram: { userId: "user-1", publicConfirmation: false, shareToFeed: true, videoUrl: "https://cdn.example.com/reel.mp4" } });
    expect(result).toEqual({ published: false, mode: "LIVE", reason: "PUBLIC_CONFIRMATION_REQUIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
