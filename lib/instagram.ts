import { randomUUID } from "node:crypto";
import { db } from "./db";
import { decryptSecret, encryptSecret } from "./secret-vault";
import type { PlatformMode } from "./types";

const PLATFORM = "instagram";
const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];
const AUTH_ENDPOINT = "https://www.instagram.com/oauth/authorize";
const TOKEN_ENDPOINT = "https://api.instagram.com/oauth/access_token";
const LONG_LIVED_TOKEN_ENDPOINT = "https://graph.instagram.com/access_token";
const REFRESH_TOKEN_ENDPOINT = "https://graph.instagram.com/refresh_access_token";

export type InstagramStatus = {
  configured: boolean;
  connected: boolean;
  authenticated: boolean;
  status: "SIGNED_OUT" | "NOT_CONFIGURED" | "DISCONNECTED" | "CONNECTED" | "ERROR" | "MISCONFIGURED";
  mode: "DRY_RUN" | "LIVE";
  accountId: string | null;
  username: string | null;
  accountType: string | null;
  accountLabel: string | null;
  channelId: string | null;
  agentId: string | null;
  tokenExpiresAt: string | null;
  tokenStoredServerSide: true;
  publishingImplemented: true;
  professionalOnly: true;
  publicOnly: true;
  safetyLock: "DRY_RUN_MODE" | "PUBLIC_CONFIRMATION_REQUIRED";
  accessLevel: "STANDARD_OR_ADVANCED";
  lastError: string | null;
};

type InstagramProfile = {
  id?: string;
  user_id?: string;
  username?: string;
  account_type?: string;
};

type InstagramTokenResponse = {
  access_token?: string;
  user_id?: string | number;
  permissions?: string;
  token_type?: string;
  expires_in?: number;
  error_type?: string;
  error_message?: string;
  error?: { message?: string };
};

function apiVersion() {
  const configured = process.env.INSTAGRAM_API_VERSION?.trim();
  return configured && /^v\d+\.\d+$/.test(configured) ? configured : "v24.0";
}

function instagramCredentials() {
  return {
    appId: process.env.INSTAGRAM_APP_ID?.trim() ?? "",
    appSecret: process.env.INSTAGRAM_APP_SECRET?.trim() ?? "",
  };
}

function redirectUri(origin?: string) {
  return process.env.INSTAGRAM_REDIRECT_URI?.trim() || `${origin ?? "http://localhost:3000"}/api/platforms/instagram/callback`;
}

function connectionKey(userId: string) {
  return { userId_platform: { userId, platform: PLATFORM } } as const;
}

function instagramAgentId(userId: string) {
  return `instagram-publisher-${userId}`;
}

function instagramChannelRecordId(userId: string, accountId: string) {
  return `${userId}:instagram:${accountId}`;
}

export function isInstagramConfigured() {
  const { appId, appSecret } = instagramCredentials();
  return Boolean(appId && appSecret && process.env.PEVIER_ENCRYPTION_KEY?.trim());
}

export function createInstagramAuthorizationUrl(origin: string, state: string) {
  const { appId } = instagramCredentials();
  if (!isInstagramConfigured()) throw new Error("Instagram OAuth is not configured.");
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_authentication", "1");
  url.searchParams.set("state", state);
  return url;
}

async function readTokenResponse(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({})) as InstagramTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_message || payload.error?.message || `${fallback} (${response.status}).`);
  }
  return payload;
}

async function fetchInstagramProfile(accessToken: string): Promise<{ id: string; username: string; accountType: string | null }> {
  const response = await fetch(
    `https://graph.instagram.com/${apiVersion()}/me?fields=id,user_id,username,account_type`,
    { cache: "no-store", headers: { authorization: `Bearer ${accessToken}` } },
  );
  const payload = await response.json().catch(() => ({})) as InstagramProfile & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `Instagram account lookup failed (${response.status}).`);
  const id = payload.user_id ?? payload.id;
  if (!id || !payload.username) throw new Error("Instagram returned no Professional account identity.");
  return { id, username: payload.username, accountType: payload.account_type ?? null };
}

async function persistInstagramProfile(userId: string, profile: { id: string; username: string }) {
  const agentId = instagramAgentId(userId);
  const channelId = instagramChannelRecordId(userId, profile.id);
  await db.$transaction(async (tx) => {
    await tx.agent.upsert({
      where: { id: agentId },
      update: { name: "Instagram policy publisher" },
      create: { id: agentId, name: "Instagram policy publisher" },
    });
    await tx.channel.upsert({
      where: { id: channelId },
      update: { name: profile.username, handle: `@${profile.username}`, platform: PLATFORM, agentId },
      create: { id: channelId, name: profile.username, handle: `@${profile.username}`, platform: PLATFORM, agentId },
    });
  });
  return { agentId, channelId };
}

export async function exchangeInstagramCode(code: string, userId: string, origin: string) {
  const { appId, appSecret } = instagramCredentials();
  const shortResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: redirectUri(origin), code }),
    cache: "no-store",
  });
  const shortToken = await readTokenResponse(shortResponse, "Instagram rejected the authorization code");

  const longUrl = new URL(LONG_LIVED_TOKEN_ENDPOINT);
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("access_token", shortToken.access_token!);
  const longToken = await readTokenResponse(await fetch(longUrl, { cache: "no-store" }), "Instagram could not create a long-lived token");
  const profile = await fetchInstagramProfile(longToken.access_token!);
  const records = await persistInstagramProfile(userId, profile);
  const expiresIn = longToken.expires_in ?? 60 * 24 * 60 * 60;

  await db.platformConnection.upsert({
    where: connectionKey(userId),
    update: {
      status: "CONNECTED", mode: "DRY_RUN", accountLabel: `@${profile.username}`, channelId: records.channelId,
      accessTokenEncrypted: encryptSecret(longToken.access_token!), refreshTokenEncrypted: encryptSecret(longToken.access_token!),
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000), scope: INSTAGRAM_SCOPES.join(" "), lastError: null,
    },
    create: {
      id: randomUUID(), userId, platform: PLATFORM, status: "CONNECTED", mode: "DRY_RUN", accountLabel: `@${profile.username}`,
      channelId: records.channelId, accessTokenEncrypted: encryptSecret(longToken.access_token!), refreshTokenEncrypted: encryptSecret(longToken.access_token!),
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000), scope: INSTAGRAM_SCOPES.join(" "), lastError: null,
    },
  });
  return { profile, userId };
}

async function refreshInstagramAccessToken(token: string) {
  const url = new URL(REFRESH_TOKEN_ENDPOINT);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  return readTokenResponse(await fetch(url, { cache: "no-store" }), "Instagram could not refresh the access token");
}

export async function getInstagramAccessToken(userId: string) {
  const connection = await db.platformConnection.findUnique({ where: connectionKey(userId) });
  if (!connection || connection.status !== "CONNECTED") throw new Error("Instagram is not connected.");
  if (connection.tokenExpiresAt.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) return decryptSecret(connection.accessTokenEncrypted);
  try {
    const refreshed = await refreshInstagramAccessToken(decryptSecret(connection.refreshTokenEncrypted));
    const expiresIn = refreshed.expires_in ?? 60 * 24 * 60 * 60;
    await db.platformConnection.update({
      where: connectionKey(userId),
      data: {
        accessTokenEncrypted: encryptSecret(refreshed.access_token!), refreshTokenEncrypted: encryptSecret(refreshed.access_token!),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000), status: "CONNECTED", lastError: null,
      },
    });
    return refreshed.access_token!;
  } catch (error) {
    await db.platformConnection.update({ where: connectionKey(userId), data: { status: "ERROR", lastError: error instanceof Error ? error.message : "Instagram token refresh failed." } });
    throw error;
  }
}

export async function getInstagramStatus(userId?: string | null): Promise<InstagramStatus> {
  const configured = isInstagramConfigured();
  const empty = {
    configured, connected: false, authenticated: Boolean(userId), mode: "DRY_RUN" as const, accountId: null, username: null,
    accountType: null, accountLabel: null, channelId: null, agentId: null, tokenExpiresAt: null, tokenStoredServerSide: true as const,
    publishingImplemented: true as const, professionalOnly: true as const, publicOnly: true as const, safetyLock: "DRY_RUN_MODE" as const,
    accessLevel: "STANDARD_OR_ADVANCED" as const, lastError: null,
  };
  if (!userId) return { ...empty, status: "SIGNED_OUT" };
  const connection = await db.platformConnection.findUnique({ where: connectionKey(userId) });
  if (!configured) return { ...empty, status: connection ? "MISCONFIGURED" : "NOT_CONFIGURED", accountLabel: connection?.accountLabel ?? null };
  if (!connection) return { ...empty, status: "DISCONNECTED" };
  const channel = connection.channelId ? await db.channel.findUnique({ where: { id: connection.channelId } }) : null;
  const username = connection.accountLabel?.replace(/^@/, "") ?? channel?.handle.replace(/^@/, "") ?? null;
  return {
    ...empty,
    connected: connection.status === "CONNECTED",
    status: connection.status === "CONNECTED" ? "CONNECTED" : "ERROR",
    mode: connection.status === "CONNECTED" && connection.mode === "LIVE" ? "LIVE" : "DRY_RUN",
    accountId: channel?.id.split(":").at(-1) ?? null,
    username,
    accountType: "PROFESSIONAL",
    accountLabel: connection.accountLabel,
    channelId: connection.channelId,
    agentId: instagramAgentId(userId),
    tokenExpiresAt: connection.tokenExpiresAt.toISOString(),
    safetyLock: connection.status === "CONNECTED" && connection.mode === "LIVE" ? "PUBLIC_CONFIRMATION_REQUIRED" : "DRY_RUN_MODE",
    lastError: connection.lastError,
  };
}

export async function setInstagramMode(userId: string, mode: Extract<PlatformMode, "DRY_RUN" | "LIVE">) {
  if (!isInstagramConfigured()) throw new Error("Instagram OAuth configuration is incomplete.");
  const connection = await db.platformConnection.findUnique({ where: connectionKey(userId) });
  if (!connection || connection.status !== "CONNECTED") throw new Error("Connect Instagram before enabling live mode.");
  return db.platformConnection.update({ where: connectionKey(userId), data: { mode } });
}

export async function disconnectInstagram(userId: string) {
  await db.platformConnection.deleteMany({ where: { userId, platform: PLATFORM } });
}

export async function resolveInstagramMode(userId?: string): Promise<PlatformMode> {
  if (!userId || !isInstagramConfigured()) return "DRY_RUN";
  const connection = await db.platformConnection.findUnique({ where: connectionKey(userId) });
  return connection?.status === "CONNECTED" && connection.mode === "LIVE" ? "LIVE" : "DRY_RUN";
}

type InstagramApiError = { error?: { message?: string } };
const REEL_PROCESSING_POLL_MS = 5_000;
const REEL_PROCESSING_MAX_ATTEMPTS = 48;

async function instagramApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as InstagramApiError | null;
  const message = payload?.error?.message?.replace(/access_token=[^&\s]+/gi, "access_token=[redacted]");
  return message ? `${fallback}: ${message.slice(0, 280)}` : `${fallback} (HTTP ${response.status}).`;
}

async function waitForContainer(containerId: string, token: string) {
  const startedAt = Date.now();
  for (let attempt = 0; attempt < REEL_PROCESSING_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`https://graph.instagram.com/${apiVersion()}/${containerId}?fields=status_code,status`, { cache: "no-store", headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(await instagramApiError(response, "Instagram could not read the Reel processing status"));
    const payload = await response.json() as { status_code?: string; status?: string };
    if (attempt === 0 || (attempt + 1) % 6 === 0 || payload.status_code !== "IN_PROGRESS") {
      console.info("[instagram-publish] Reel container status", {
        containerId,
        statusCode: payload.status_code ?? "UNKNOWN",
        attempt: attempt + 1,
        elapsedMs: Date.now() - startedAt,
      });
    }
    if (payload.status_code === "FINISHED") return;
    if (payload.status_code === "ERROR" || payload.status_code === "EXPIRED") throw new Error(`Instagram could not process the Reel: ${payload.status ?? payload.status_code}.`);
    if (attempt < REEL_PROCESSING_MAX_ATTEMPTS - 1) await new Promise((resolve) => setTimeout(resolve, REEL_PROCESSING_POLL_MS));
  }
  throw new Error("Instagram was still processing the Reel after four minutes. Nothing was published; try again with a shorter MP4 video.");
}

export async function publishInstagramReel(userId: string, videoUrl: string, options: { caption: string; shareToFeed: boolean }) {
  const source = new URL(videoUrl);
  if (source.protocol !== "https:") throw new Error("Instagram requires a public HTTPS video URL.");
  const token = await getInstagramAccessToken(userId);
  const status = await getInstagramStatus(userId);
  if (!status.connected || !status.accountId) throw new Error(status.lastError ?? "Instagram account identity could not be verified.");

  const containerUrl = new URL(`https://graph.instagram.com/${apiVersion()}/${status.accountId}/media`);
  containerUrl.searchParams.set("media_type", "REELS");
  containerUrl.searchParams.set("video_url", source.toString());
  containerUrl.searchParams.set("caption", options.caption);
  containerUrl.searchParams.set("share_to_feed", options.shareToFeed ? "true" : "false");
  const containerResponse = await fetch(containerUrl, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  if (!containerResponse.ok) throw new Error(await instagramApiError(containerResponse, "Instagram could not create the Reel container"));
  const container = await containerResponse.json() as { id?: string };
  if (!container.id) throw new Error("Instagram returned no Reel container ID.");

  await waitForContainer(container.id, token);
  const publishUrl = new URL(`https://graph.instagram.com/${apiVersion()}/${status.accountId}/media_publish`);
  publishUrl.searchParams.set("creation_id", container.id);
  const publishResponse = await fetch(publishUrl, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  if (!publishResponse.ok) throw new Error(await instagramApiError(publishResponse, "Instagram could not publish the Reel"));
  const published = await publishResponse.json() as { id?: string };
  if (!published.id) throw new Error("Instagram returned no published media ID.");
  return { id: published.id, containerId: container.id };
}
