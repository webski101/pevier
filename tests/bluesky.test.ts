import { afterEach, describe, expect, it } from "vitest";
import { getBlueskyClientMetadata, validateBlueskyText } from "../lib/bluesky";

const originalPublicUrl = process.env.BLUESKY_PUBLIC_URL;

afterEach(() => {
  if (originalPublicUrl === undefined) delete process.env.BLUESKY_PUBLIC_URL;
  else process.env.BLUESKY_PUBLIC_URL = originalPublicUrl;
});

describe("Bluesky OAuth metadata", () => {
  it("publishes the canonical Pevier client and callback URLs", () => {
    process.env.BLUESKY_PUBLIC_URL = "https://pevier.vercel.app/";
    const metadata = getBlueskyClientMetadata("https://preview.example");
    expect(metadata.client_id).toBe("https://pevier.vercel.app/api/platforms/bluesky/client-metadata");
    expect(metadata.redirect_uris).toEqual(["https://pevier.vercel.app/api/platforms/bluesky/callback"]);
    expect(metadata.token_endpoint_auth_method).toBe("private_key_jwt");
    expect(metadata.dpop_bound_access_tokens).toBe(true);
  });
});

describe("Bluesky post validation", () => {
  it("accepts a post at the 300-grapheme limit", () => {
    expect(validateBlueskyText("a".repeat(300)).graphemeLength).toBe(300);
  });

  it("counts a joined emoji as one grapheme", () => {
    expect(validateBlueskyText("👨‍👩‍👧‍👧").graphemeLength).toBe(1);
  });

  it("rejects a post over the network limit", () => {
    expect(() => validateBlueskyText("a".repeat(301))).toThrow(/limited to 300 characters/i);
  });
});
