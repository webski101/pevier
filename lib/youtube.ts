import { randomUUID } from "node:crypto";
import { db } from "./db";
import { decryptSecret, encryptSecret } from "./secret-vault";
import type { PlatformMode } from "./types";

const PLATFORM = "youtube";
const YOUTUBE_AGENT_ID = "youtube-private-publisher";
const YOUTUBE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const CHANNELS_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";
const UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/youtube/v3/videos";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type UploadMetadata = {
  title: string;
  description?: string;
  categoryId?: string;
};

type YouTubeChannelProfile = {
  id: string;
  title: string;
  handle: string;
};

type GoogleIdentity = { sub: string; email: string; name?: string; picture?: string };

function connectionKey(userId: string) {
  return { userId_platform: { userId, platform: PLATFORM } } as const;
}

function youtubeAgentId(userId: string) {
  return `${YOUTUBE_AGENT_ID}-${userId}`;
}

function youtubeChannelRecordId(userId: string, channelId: string) {
  return `${userId}:youtube:${channelId}`;
}

function googleCredentials() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
  };
}

function redirectUri(origin?: string) {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || `${origin ?? "http://localhost:3000"}/api/platforms/youtube/callback`;
}

export function isYouTubeConfigured() {
  const { clientId, clientSecret } = googleCredentials();
  return Boolean(clientId && clientSecret && process.env.PEVIER_ENCRYPTION_KEY?.trim());
}

export function createYouTubeAuthorizationUrl(origin: string, state: string) {
  const { clientId } = googleCredentials();
  if (!isYouTubeConfigured()) throw new Error("YouTube OAuth is not configured.");

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url;
}

async function fetchYouTubeChannelProfile(accessToken: string): Promise<YouTubeChannelProfile> {
  const url = new URL(CHANNELS_ENDPOINT);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "1");
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as {
    items?: Array<{ id?: string; snippet?: { title?: string; customUrl?: string } }>;
    error?: { message?: string };
  };
  const channel = payload.items?.[0];
  if (!response.ok) throw new Error(payload.error?.message || `YouTube channel lookup failed (${response.status}).`);
  if (!channel?.id || !channel.snippet?.title) throw new Error("This Google account does not have a YouTube channel.");
  return {
    id: channel.id,
    title: channel.snippet.title,
    handle: channel.snippet.customUrl || `youtube.com/channel/${channel.id}`,
  };
}

async function fetchGoogleIdentity(accessToken: string): Promise<GoogleIdentity> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as Partial<GoogleIdentity> & { error?: string };
  if (!response.ok || !payload.sub || !payload.email) throw new Error(payload.error || "Google account identity could not be verified.");
  return { sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
}

async function persistYouTubeChannelProfile(userId: string, profile: YouTubeChannelProfile) {
  const agentId = youtubeAgentId(userId);
  const channelRecordId = youtubeChannelRecordId(userId, profile.id);
  await db.$transaction(async (tx) => {
    await tx.agent.upsert({
      where: { id: agentId },
      update: { name: "YouTube private publisher" },
      create: { id: agentId, name: "YouTube private publisher" },
    });
    await tx.channel.upsert({
      where: { id: channelRecordId },
      update: { name: profile.title, handle: profile.handle, platform: PLATFORM, agentId },
      create: { id: channelRecordId, name: profile.title, handle: profile.handle, platform: PLATFORM, agentId },
    });
  });
  return channelRecordId;
}

async function readTokenResponse(response: Response) {
  const payload = await response.json() as TokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Google rejected the OAuth token request.");
  }
  return payload;
}

export async function exchangeYouTubeCode(code: string, origin: string) {
  const { clientId, clientSecret } = googleCredentials();
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const tokens = await readTokenResponse(response);
  if (!tokens.refresh_token) throw new Error("Google did not return an offline refresh token. Reconnect and grant access again.");

  const identity = await fetchGoogleIdentity(tokens.access_token!);
  const user = await db.user.upsert({
    where: { googleSubject: identity.sub },
    update: { email: identity.email, name: identity.name, avatarUrl: identity.picture },
    create: { googleSubject: identity.sub, email: identity.email, name: identity.name, avatarUrl: identity.picture },
  });

  let channel: YouTubeChannelProfile | null = null;
  let channelLookupError: string | null = null;
  try {
    channel = await fetchYouTubeChannelProfile(tokens.access_token!);
    await persistYouTubeChannelProfile(user.id, channel);
  } catch (error) {
    channelLookupError = error instanceof Error ? error.message : "YouTube channel identity could not be loaded.";
  }

  await db.platformConnection.upsert({
    where: connectionKey(user.id),
    update: {
      status: "CONNECTED",
      mode: "DRY_RUN",
      accessTokenEncrypted: encryptSecret(tokens.access_token!),
      refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      scope: tokens.scope ?? YOUTUBE_SCOPES.join(" "),
      accountLabel: channel?.title ?? "Authorized YouTube channel",
      channelId: channel ? youtubeChannelRecordId(user.id, channel.id) : null,
      lastError: channelLookupError,
    },
    create: {
      id: randomUUID(),
      userId: user.id,
      platform: PLATFORM,
      status: "CONNECTED",
      mode: "DRY_RUN",
      accountLabel: channel?.title ?? "Authorized YouTube channel",
      channelId: channel ? youtubeChannelRecordId(user.id, channel.id) : null,
      accessTokenEncrypted: encryptSecret(tokens.access_token!),
      refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      scope: tokens.scope ?? YOUTUBE_SCOPES.join(" "),
      lastError: channelLookupError,
    },
  });
  return user;
}

async function refreshYouTubeAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = googleCredentials();
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  return readTokenResponse(response);
}

export async function getYouTubeAccessToken(userId: string) {
  const connection = await db.platformConnection.findUnique({ where: connectionKey(userId) });
  if (!connection || connection.status !== "CONNECTED") throw new Error("YouTube is not connected.");

  if (connection.tokenExpiresAt.getTime() > Date.now() + 60_000) return decryptSecret(connection.accessTokenEncrypted);

  try {
    const tokens = await refreshYouTubeAccessToken(decryptSecret(connection.refreshTokenEncrypted));
    await db.platformConnection.update({
      where: connectionKey(userId),
      data: {
        accessTokenEncrypted: encryptSecret(tokens.access_token!),
        tokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
        status: "CONNECTED",
        lastError: null,
      },
    });
    return tokens.access_token!;
  } catch (error) {
    await db.platformConnection.update({
      where: connectionKey(userId),
      data: { status: "ERROR", lastError: error instanceof Error ? error.message : "Token refresh failed." },
    });
    throw error;
  }
}

export async function getYouTubeStatus(userId?: string | null) {
  if (!userId) return {
    configured: isYouTubeConfigured(), connected: false, authenticated: false, status: "SIGNED_OUT", mode: "DRY_RUN" as PlatformMode,
    accountLabel: null, channelId: null, channelHandle: null, agentId: null, tokenExpiresAt: null,
    privateOnly: true as const, observedUploads: 0, uploadLimit: 100, lastError: null,
  };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [connection, observedUploads] = await Promise.all([
    db.platformConnection.findUnique({ where: connectionKey(userId) }),
    db.post.count({ where: { agentId: youtubeAgentId(userId), platform: PLATFORM, status: "LIVE_PUBLISHED", createdAt: { gte: start } } }),
  ]);
  const configured = isYouTubeConfigured();
  const connected = configured && connection?.status === "CONNECTED";
  const channel = connection?.channelId ? await db.channel.findUnique({ where: { id: connection.channelId } }) : null;
  return {
    configured,
    connected,
    authenticated: true,
    status: connection && !configured ? "MISCONFIGURED" : connection?.status ?? "DISCONNECTED",
    mode: (connected ? connection?.mode : "DRY_RUN") as PlatformMode,
    accountLabel: connection?.accountLabel ?? null,
    channelId: connection?.channelId ?? null,
    channelHandle: channel?.handle ?? null,
    agentId: channel?.agentId ?? null,
    tokenExpiresAt: connection?.tokenExpiresAt.toISOString() ?? null,
    privateOnly: true as const,
    observedUploads,
    uploadLimit: 100,
    lastError: connection?.lastError ?? null,
  };
}

export async function setYouTubeMode(userId: string, mode: Extract<PlatformMode, "DRY_RUN" | "LIVE">) {
  if (!isYouTubeConfigured()) throw new Error("YouTube OAuth configuration is incomplete.");
  const connection = await db.platformConnection.findUnique({ where: connectionKey(userId) });
  if (!connection || connection.status !== "CONNECTED") throw new Error("Connect YouTube before enabling live mode.");
  return db.platformConnection.update({ where: connectionKey(userId), data: { mode } });
}

export async function disconnectYouTube(userId: string) {
  await db.platformConnection.deleteMany({ where: { userId, platform: PLATFORM } });
}

export async function resolveYouTubeMode(userId?: string): Promise<PlatformMode> {
  if (!userId || !isYouTubeConfigured()) return "DRY_RUN";
  const connection = await db.platformConnection.findUnique({ where: connectionKey(userId) });
  return connection?.status === "CONNECTED" && connection.mode === "LIVE" ? "LIVE" : "DRY_RUN";
}

export async function createPrivateYouTubeUpload(
  accessToken: string,
  video: { bytes: Uint8Array; mimeType: string },
  metadata: UploadMetadata,
) {
  const startUrl = new URL(UPLOAD_ENDPOINT);
  startUrl.searchParams.set("uploadType", "resumable");
  startUrl.searchParams.set("part", "snippet,status");

  let start: Response;
  try {
    start = await fetch(startUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-length": String(video.bytes.byteLength),
        "x-upload-content-type": video.mimeType,
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title,
          description: metadata.description ?? "",
          categoryId: metadata.categoryId ?? "22",
        },
        status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
      }),
      cache: "no-store",
    });
  } catch {
    throw new Error("YouTube is unreachable from the Pevier server.");
  }
  const uploadUrl = start.headers.get("location");
  if (!start.ok || !uploadUrl) {
    const payload = await start.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(payload.error?.message || `YouTube could not start the upload (${start.status}).`);
  }

  let upload: Response;
  try {
    upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": video.mimeType,
        "content-length": String(video.bytes.byteLength),
      },
      body: Buffer.from(video.bytes),
      cache: "no-store",
    });
  } catch {
    throw new Error("The connection to YouTube failed while transferring the video.");
  }
  const payload = await upload.json().catch(() => ({})) as {
    id?: string;
    snippet?: { channelId?: string; channelTitle?: string };
    error?: { message?: string };
  };
  if (!upload.ok || !payload.id) throw new Error(payload.error?.message || `YouTube upload failed (${upload.status}).`);
  return {
    id: payload.id,
    privacyStatus: "private" as const,
    channelId: payload.snippet?.channelId,
    channelTitle: payload.snippet?.channelTitle,
  };
}

export async function uploadPrivateYouTubeVideo(userId: string, video: { bytes: Uint8Array; mimeType: string }, metadata: UploadMetadata) {
  const result = await createPrivateYouTubeUpload(await getYouTubeAccessToken(userId), video, metadata);
  if (result.channelId && result.channelTitle) {
    const profile = { id: result.channelId, title: result.channelTitle, handle: `youtube.com/channel/${result.channelId}` };
    const channelRecordId = await persistYouTubeChannelProfile(userId, profile);
    await db.platformConnection.update({
      where: connectionKey(userId),
      data: { accountLabel: profile.title, channelId: channelRecordId, lastError: null },
    });
  }
  return result;
}
