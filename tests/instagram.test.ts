import { afterEach, describe, expect, it, vi } from "vitest";
import { InstagramAdapter } from "../lib/adapters";
import { getInstagramStatus, publishInstagramReel } from "../lib/instagram";

describe("Instagram connection safety", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.INSTAGRAM_APP_ID;
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_API_VERSION;
    delete process.env.INSTAGRAM_PUBLISH_MODE;
  });

  it("stays unconfigured without server credentials", async () => {
    delete process.env.INSTAGRAM_APP_ID;
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const status = await getInstagramStatus();

    expect(status).toMatchObject({ configured: false, connected: false, mode: "DRY_RUN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies professional account identity without exposing the token", async () => {
    process.env.INSTAGRAM_APP_ID = "app-123";
    process.env.INSTAGRAM_ACCESS_TOKEN = "server-secret-token";
    process.env.INSTAGRAM_PUBLISH_MODE = "LIVE";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      id: "ig-456",
      username: "pevier_test",
      account_type: "MEDIA_CREATOR",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const status = await getInstagramStatus();

    expect(status).toMatchObject({
      configured: true,
      connected: true,
      status: "CONNECTED",
      mode: "LIVE",
      requestedMode: "LIVE",
      accountId: "ig-456",
      username: "pevier_test",
      publishingImplemented: true,
      safetyLock: "PUBLIC_CONFIRMATION_REQUIRED",
    });
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer server-secret-token");
    expect(JSON.stringify(status)).not.toContain("server-secret-token");
  });

  it("fails closed when Instagram rejects the token", async () => {
    process.env.INSTAGRAM_APP_ID = "app-123";
    process.env.INSTAGRAM_ACCESS_TOKEN = "expired-secret-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "expired" } }, { status: 401 })));

    const status = await getInstagramStatus();

    expect(status).toMatchObject({ connected: false, status: "ERROR", mode: "DRY_RUN" });
    expect(status.lastError).toContain("rejected the access token");
    expect(JSON.stringify(status)).not.toContain("expired-secret-token");
  });

  it("never calls Instagram while the publishing adapter is locked", async () => {
    process.env.INSTAGRAM_PUBLISH_MODE = "LIVE";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await new InstagramAdapter("DRY_RUN").publish({
      agentId: "agent-1",
      channelId: "instagram-1",
      platform: "instagram",
      title: "Dry-run Instagram post",
      contentText: "Policy-safe simulation content.",
    });

    expect(result).toEqual({ published: false, mode: "DRY_RUN", reason: "DRY_RUN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a per-request public confirmation in live mode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await new InstagramAdapter("LIVE").publish({
      agentId: "agent-1",
      channelId: "instagram-1",
      platform: "instagram",
      title: "Public Reel",
      contentText: "Reviewed public Reel.",
    }, { instagram: { publicConfirmation: false, shareToFeed: true, videoUrl: "https://cdn.example.com/reel.mp4" } });

    expect(result).toEqual({ published: false, mode: "LIVE", reason: "PUBLIC_CONFIRMATION_REQUIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a public video URL for a confirmed Reel with Instagram Login", async () => {
    process.env.INSTAGRAM_APP_ID = "app-123";
    process.env.INSTAGRAM_ACCESS_TOKEN = "server-secret-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ id: "ig-456", username: "pevier_test", account_type: "MEDIA_CREATOR" }))
      .mockResolvedValueOnce(Response.json({ id: "container-789" }))
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED", status: "Finished" }))
      .mockResolvedValueOnce(Response.json({ id: "media-101" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishInstagramReel(
      "https://cdn.example.com/reel.mp4",
      { caption: "Confirmed public Reel", shareToFeed: true },
    );

    expect(result).toEqual({ id: "media-101", containerId: "container-789" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const containerRequest = fetchMock.mock.calls[1];
    const containerUrl = new URL(String(containerRequest[0]));
    expect(containerUrl.pathname).toBe("/v23.0/ig-456/media");
    expect(containerUrl.searchParams.get("media_type")).toBe("REELS");
    expect(containerUrl.searchParams.get("video_url")).toBe("https://cdn.example.com/reel.mp4");
    expect(containerUrl.searchParams.has("upload_type")).toBe(false);
    expect(containerUrl.searchParams.get("caption")).toBe("Confirmed public Reel");
    expect(containerUrl.searchParams.get("share_to_feed")).toBe("true");
    expect(containerRequest[1].body).toBeUndefined();
    expect(fetchMock.mock.calls[2][0]).toContain("/container-789?fields=status_code,status");
    const publishUrl = new URL(String(fetchMock.mock.calls[3][0]));
    expect(publishUrl.pathname).toBe("/v23.0/ig-456/media_publish");
    expect(publishUrl.searchParams.get("creation_id")).toBe("container-789");
  });
});
