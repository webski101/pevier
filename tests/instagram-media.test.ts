import { describe, expect, it, vi } from "vitest";
import {
  MAX_INSTAGRAM_VIDEO_BYTES,
  instagramUploadPath,
  isOwnedInstagramBlobUrl,
  isSupportedInstagramVideo,
} from "../lib/instagram-media";

describe("temporary Instagram media", () => {
  it("creates an account-scoped, sanitized upload path", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    expect(instagramUploadPath("17890001", "My Reel (final) 🎬.mp4"))
      .toBe("instagram/17890001/1234-My-Reel-final-.mp4");
    vi.restoreAllMocks();
  });

  it("accepts supported videos within the temporary upload limit", () => {
    expect(isSupportedInstagramVideo({ type: "video/mp4", size: MAX_INSTAGRAM_VIDEO_BYTES })).toBe(true);
    expect(isSupportedInstagramVideo({ type: "video/webm", size: 1024 })).toBe(false);
    expect(isSupportedInstagramVideo({ type: "video/mp4", size: MAX_INSTAGRAM_VIDEO_BYTES + 1 })).toBe(false);
  });

  it("only recognizes the connected account's public Vercel Blob path", () => {
    expect(isOwnedInstagramBlobUrl(
      "https://abc.public.blob.vercel-storage.com/instagram/17890001/reel-random.mp4",
      "17890001",
    )).toBe(true);
    expect(isOwnedInstagramBlobUrl(
      "https://abc.public.blob.vercel-storage.com/instagram/other/reel.mp4",
      "17890001",
    )).toBe(false);
    expect(isOwnedInstagramBlobUrl("https://cdn.example.com/instagram/17890001/reel.mp4", "17890001")).toBe(false);
  });
});
