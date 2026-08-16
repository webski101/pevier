import { db } from "./db";
import { uploadPrivateYouTubeVideo } from "./youtube";
import { publishInstagramReel } from "./instagram";
import type { PlatformDelivery, PlatformMode, PublishRequest } from "./types";

export type PublicationResult = {
  published: boolean;
  mode: PlatformMode;
  externalId?: string;
  reason?: string;
  privacyStatus?: "private";
  visibility?: "public";
};

export interface PlatformAdapter {
  getPublishingLimits(): Promise<{ used: number; limit: number; source: string }>;
  publish(request: PublishRequest, delivery?: PlatformDelivery): Promise<PublicationResult>;
  validateCredentials(): Promise<boolean>;
}

class DryRunAdapter implements PlatformAdapter {
  constructor(private platform: string, private mode: PlatformMode = "DRY_RUN") {}
  async getPublishingLimits() { return { used: 0, limit: 100, source: `${this.platform} dry-run quota` }; }
  async validateCredentials() { return this.mode !== "LIVE"; }
  async publish(request: PublishRequest) {
    void request;
    return { published: false, mode: this.mode, reason: this.mode === "LIVE" ? "LIVE_ADAPTER_NOT_IMPLEMENTED" : "DRY_RUN" };
  }
}

export class YouTubeAdapter implements PlatformAdapter {
  constructor(private mode: PlatformMode = "DRY_RUN") {}

  async getPublishingLimits() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const used = await db.post.count({ where: { platform: "youtube", status: "LIVE_PUBLISHED", createdAt: { gte: start } } });
    return { used, limit: 100, source: "Pevier-observed YouTube uploads" };
  }

  async validateCredentials() {
    return this.mode !== "LIVE";
  }

  async publish(request: PublishRequest, delivery?: PlatformDelivery): Promise<PublicationResult> {
    if (this.mode !== "LIVE") return { published: false, mode: this.mode, reason: "DRY_RUN" };
    if (!delivery?.youtube?.userId) return { published: false, mode: this.mode, reason: "USER_SESSION_REQUIRED" };
    if (!delivery?.video) return { published: false, mode: this.mode, reason: "VIDEO_REQUIRED" };

    const result = await uploadPrivateYouTubeVideo(delivery.youtube.userId, delivery.video, {
      title: request.title,
      description: request.description,
    });
    return { published: true, mode: this.mode, externalId: result.id, privacyStatus: result.privacyStatus };
  }
}

export class InstagramAdapter implements PlatformAdapter {
  constructor(private mode: PlatformMode = "DRY_RUN") {}
  async getPublishingLimits() { return { used: 0, limit: 100, source: "Pevier-observed Instagram publications" }; }
  async validateCredentials() {
    return this.mode !== "LIVE";
  }
  async publish(request: PublishRequest, delivery?: PlatformDelivery): Promise<PublicationResult> {
    if (this.mode !== "LIVE") return { published: false, mode: "DRY_RUN", reason: "DRY_RUN" };
    if (!delivery?.instagram?.userId) return { published: false, mode: "LIVE", reason: "USER_SESSION_REQUIRED" };
    if (!delivery?.instagram?.publicConfirmation) return { published: false, mode: "LIVE", reason: "PUBLIC_CONFIRMATION_REQUIRED" };
    if (!delivery.instagram.videoUrl) return { published: false, mode: "LIVE", reason: "INSTAGRAM_PUBLIC_VIDEO_URL_REQUIRED" };
    const result = await publishInstagramReel(delivery.instagram.userId, delivery.instagram.videoUrl, {
      caption: request.description ?? request.contentText,
      shareToFeed: delivery.instagram.shareToFeed,
    });
    return { published: true, mode: "LIVE", externalId: result.id, visibility: "public" };
  }
}
export class MockAdapter extends DryRunAdapter { constructor(mode: PlatformMode = "DRY_RUN") { super("mock", mode); } }

export function getAdapter(platform: string, mode: PlatformMode = "DRY_RUN"): PlatformAdapter {
  if (platform === "youtube") return new YouTubeAdapter(mode);
  if (platform === "instagram") return new InstagramAdapter(mode);
  return new MockAdapter(mode);
}
