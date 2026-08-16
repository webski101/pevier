import { randomUUID } from "node:crypto";
import { Agent, RichText } from "@atproto/api";
import {
  JoseKey,
  NodeOAuthClient,
  requestLocalLock,
  type NodeSavedSession,
  type NodeSavedState,
  type OAuthSession,
  type RuntimeLock,
} from "@atproto/oauth-client-node";
import { db } from "./db";
import { decryptSecret, encryptSecret } from "./secret-vault";
import type { PlatformMode } from "./types";

const PLATFORM = "bluesky";
const OAUTH_SCOPE = "atproto transition:generic";
const STATE_LIFETIME_MS = 60 * 60 * 1000;

export type BlueskyStatus = {
  configured: boolean;
  connected: boolean;
  authenticated: boolean;
  status: "SIGNED_OUT" | "NOT_CONFIGURED" | "DISCONNECTED" | "CONNECTED" | "ERROR";
  mode: "DRY_RUN" | "LIVE";
  did: string | null;
  handle: string | null;
  accountLabel: string | null;
  channelId: string | null;
  agentId: string | null;
  oauthManaged: true;
  appPasswordStored: false;
  platformReviewRequired: false;
  safetyLock: "DRY_RUN_MODE" | "PUBLIC_CONFIRMATION_REQUIRED";
  lastError: string | null;
};

function canonicalOrigin(origin?: string) {
  const value = process.env.BLUESKY_PUBLIC_URL?.trim() || origin || (process.env.NODE_ENV === "production" ? "https://pevier.vercel.app" : "http://localhost:3000");
  return value.replace(/\/$/, "");
}

function privateKeyValue() {
  return process.env.BLUESKY_OAUTH_PRIVATE_KEY?.trim().replace(/\\n/g, "\n") ?? "";
}

function connectionKey(userId: string) {
  return { userId_platform: { userId, platform: PLATFORM } } as const;
}

export function blueskyAgentId(userId: string) {
  return `bluesky-publisher-${userId}`;
}

function blueskyChannelId(userId: string, did: string) {
  return `${userId}:bluesky:${did}`;
}

export function getBlueskyClientMetadata(origin?: string) {
  const base = canonicalOrigin(origin);
  return {
    client_id: `${base}/api/platforms/bluesky/client-metadata`,
    client_name: "Pevier Policy Firewall",
    client_uri: base,
    policy_uri: `${base}/privacy`,
    tos_uri: `${base}/terms`,
    redirect_uris: [`${base}/api/platforms/bluesky/callback`] as [string],
    grant_types: ["authorization_code", "refresh_token"] as ["authorization_code", "refresh_token"],
    scope: OAUTH_SCOPE,
    response_types: ["code"] as ["code"],
    application_type: "web" as const,
    token_endpoint_auth_method: "private_key_jwt" as const,
    token_endpoint_auth_signing_alg: "ES256",
    dpop_bound_access_tokens: true,
    jwks_uri: `${base}/api/platforms/bluesky/jwks`,
  };
}

export function isBlueskyConfigured() {
  return Boolean(privateKeyValue() && process.env.PEVIER_ENCRYPTION_KEY?.trim());
}

const stateStore = {
  async set(key: string, value: NodeSavedState) {
    await db.$transaction([
      db.blueskyOAuthState.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - STATE_LIFETIME_MS) } } }),
      db.blueskyOAuthState.upsert({
        where: { key },
        update: { dataEncrypted: encryptSecret(JSON.stringify(value)), createdAt: new Date() },
        create: { key, dataEncrypted: encryptSecret(JSON.stringify(value)) },
      }),
    ]);
  },
  async get(key: string) {
    const record = await db.blueskyOAuthState.findUnique({ where: { key } });
    if (!record || record.createdAt.getTime() < Date.now() - STATE_LIFETIME_MS) return undefined;
    return JSON.parse(decryptSecret(record.dataEncrypted)) as NodeSavedState;
  },
  async del(key: string) {
    await db.blueskyOAuthState.deleteMany({ where: { key } });
  },
};

const sessionStore = {
  async set(did: string, value: NodeSavedSession) {
    const dataEncrypted = encryptSecret(JSON.stringify(value));
    await db.blueskyOAuthSession.upsert({
      where: { did },
      update: { dataEncrypted },
      create: { did, dataEncrypted },
    });
  },
  async get(did: string) {
    const record = await db.blueskyOAuthSession.findUnique({ where: { did } });
    return record ? JSON.parse(decryptSecret(record.dataEncrypted)) as NodeSavedSession : undefined;
  },
  async del(did: string) {
    await db.blueskyOAuthSession.deleteMany({ where: { did } });
  },
};

const databaseRequestLock: RuntimeLock = async (key, fn) => {
  if (!process.env.DATABASE_URL?.startsWith("postgres")) return requestLocalLock(key, fn);
  return db.$transaction(async (tx) => {
    // PostgreSQL returns the advisory-lock function as the pseudo-type `void`.
    // Prisma cannot deserialize that type, so expose the result as text while
    // preserving the transaction-scoped locking side effect.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pevier-bluesky:${key}`}, 0))::text AS lock_result`;
    return fn();
  }, { maxWait: 10_000, timeout: 45_000 });
};

type BlueskyGlobal = typeof globalThis & { pevierBlueskyClient?: Promise<NodeOAuthClient> };

export async function getBlueskyOAuthClient(origin?: string) {
  if (!isBlueskyConfigured()) throw new Error("Bluesky OAuth is not configured.");
  const globalState = globalThis as BlueskyGlobal;
  if (!globalState.pevierBlueskyClient) {
    globalState.pevierBlueskyClient = (async () => {
      const key = await JoseKey.fromImportable(privateKeyValue(), "pevier-bluesky-oauth-1");
      return new NodeOAuthClient({
        clientMetadata: getBlueskyClientMetadata(origin),
        keyset: [key],
        stateStore,
        sessionStore,
        requestLock: databaseRequestLock,
        responseMode: "query",
        allowHttp: process.env.NODE_ENV !== "production",
      });
    })();
  }
  return globalState.pevierBlueskyClient;
}

export async function getBlueskyJwks(origin?: string) {
  return (await getBlueskyOAuthClient(origin)).jwks;
}

export async function createBlueskyAuthorizationUrl(identifier: string, state: string, origin: string) {
  const normalized = identifier.trim().replace(/^@/, "");
  if (!normalized || normalized.length > 253) throw new Error("Enter a valid Bluesky account or provider.");
  return (await getBlueskyOAuthClient(origin)).authorize(normalized, { state });
}

export async function callbackBlueskyAuthorization(params: URLSearchParams, origin: string) {
  return (await getBlueskyOAuthClient(origin)).callback(params);
}

async function persistBlueskyProfile(userId: string, profile: { did: string; handle: string; displayName?: string }) {
  const agentId = blueskyAgentId(userId);
  const channelId = blueskyChannelId(userId, profile.did);
  await db.$transaction(async (tx) => {
    await tx.agent.upsert({
      where: { id: agentId },
      update: { name: "Bluesky policy publisher" },
      create: { id: agentId, name: "Bluesky policy publisher" },
    });
    await tx.channel.upsert({
      where: { id: channelId },
      update: { name: profile.displayName || profile.handle, handle: `@${profile.handle}`, platform: PLATFORM, agentId },
      create: { id: channelId, name: profile.displayName || profile.handle, handle: `@${profile.handle}`, platform: PLATFORM, agentId },
    });
  });
  return { agentId, channelId };
}

export async function finalizeBlueskyConnection(userId: string, session: OAuthSession) {
  const existingOwner = await db.blueskyOAuthSession.findUnique({ where: { did: session.did } });
  if (existingOwner?.userId && existingOwner.userId !== userId) {
    await session.signOut().catch(() => undefined);
    throw new Error("That Bluesky account is already connected to another Pevier user.");
  }

  const previous = await db.blueskyOAuthSession.findUnique({ where: { userId } });
  if (previous && previous.did !== session.did) {
    await (await getBlueskyOAuthClient()).revoke(previous.did).catch(() => undefined);
    await db.blueskyOAuthSession.deleteMany({ where: { did: previous.did } });
  }

  const agent = new Agent(session);
  const response = await agent.getProfile({ actor: session.did });
  const profile = { did: response.data.did, handle: response.data.handle, displayName: response.data.displayName };
  const records = await persistBlueskyProfile(userId, profile);

  await db.$transaction([
    db.blueskyOAuthSession.update({ where: { did: session.did }, data: { userId } }),
    db.platformConnection.upsert({
      where: connectionKey(userId),
      update: {
        status: "CONNECTED", mode: "DRY_RUN", accountLabel: `@${profile.handle}`, channelId: records.channelId,
        accessTokenEncrypted: encryptSecret(`oauth-session:${session.did}`), refreshTokenEncrypted: encryptSecret(`oauth-session:${session.did}`),
        tokenExpiresAt: new Date("2999-01-01T00:00:00.000Z"), scope: OAUTH_SCOPE, lastError: null,
      },
      create: {
        id: randomUUID(), userId, platform: PLATFORM, status: "CONNECTED", mode: "DRY_RUN", accountLabel: `@${profile.handle}`,
        channelId: records.channelId, accessTokenEncrypted: encryptSecret(`oauth-session:${session.did}`),
        refreshTokenEncrypted: encryptSecret(`oauth-session:${session.did}`), tokenExpiresAt: new Date("2999-01-01T00:00:00.000Z"),
        scope: OAUTH_SCOPE, lastError: null,
      },
    }),
  ]);
  return profile;
}

export async function getBlueskyStatus(userId?: string | null): Promise<BlueskyStatus> {
  const configured = isBlueskyConfigured();
  const empty = {
    configured, connected: false, authenticated: Boolean(userId), mode: "DRY_RUN" as const, did: null, handle: null,
    accountLabel: null, channelId: null, agentId: null, oauthManaged: true as const, appPasswordStored: false as const,
    platformReviewRequired: false as const, safetyLock: "DRY_RUN_MODE" as const, lastError: null,
  };
  if (!userId) return { ...empty, status: "SIGNED_OUT" };
  const [connection, oauthSession] = await Promise.all([
    db.platformConnection.findUnique({ where: connectionKey(userId) }),
    db.blueskyOAuthSession.findUnique({ where: { userId } }),
  ]);
  if (!configured) return { ...empty, status: "NOT_CONFIGURED", accountLabel: connection?.accountLabel ?? null };
  if (!connection || !oauthSession) return { ...empty, status: "DISCONNECTED" };
  const handle = connection.accountLabel?.replace(/^@/, "") ?? null;
  return {
    ...empty,
    connected: connection.status === "CONNECTED",
    status: connection.status === "CONNECTED" ? "CONNECTED" : "ERROR",
    mode: connection.status === "CONNECTED" && connection.mode === "LIVE" ? "LIVE" : "DRY_RUN",
    did: oauthSession.did,
    handle,
    accountLabel: connection.accountLabel,
    channelId: connection.channelId,
    agentId: blueskyAgentId(userId),
    safetyLock: connection.status === "CONNECTED" && connection.mode === "LIVE" ? "PUBLIC_CONFIRMATION_REQUIRED" : "DRY_RUN_MODE",
    lastError: connection.lastError,
  };
}

export async function setBlueskyMode(userId: string, mode: Extract<PlatformMode, "DRY_RUN" | "LIVE">) {
  if (!isBlueskyConfigured()) throw new Error("Bluesky OAuth configuration is incomplete.");
  const connection = await db.platformConnection.findUnique({ where: connectionKey(userId) });
  if (!connection || connection.status !== "CONNECTED") throw new Error("Connect Bluesky before enabling live mode.");
  return db.platformConnection.update({ where: connectionKey(userId), data: { mode } });
}

export async function disconnectBluesky(userId: string) {
  const session = await db.blueskyOAuthSession.findUnique({ where: { userId } });
  if (session && isBlueskyConfigured()) await (await getBlueskyOAuthClient()).revoke(session.did).catch(() => undefined);
  await db.$transaction([
    db.platformConnection.deleteMany({ where: { userId, platform: PLATFORM } }),
    db.blueskyOAuthSession.deleteMany({ where: { userId } }),
  ]);
}

export async function resolveBlueskyMode(userId?: string): Promise<PlatformMode> {
  if (!userId || !isBlueskyConfigured()) return "DRY_RUN";
  const connection = await db.platformConnection.findUnique({ where: connectionKey(userId) });
  return connection?.status === "CONNECTED" && connection.mode === "LIVE" ? "LIVE" : "DRY_RUN";
}

export function validateBlueskyText(text: string) {
  const richText = new RichText({ text });
  if (richText.graphemeLength < 1) throw new Error("Write a Bluesky post before evaluating it.");
  if (richText.graphemeLength > 300) throw new Error(`Bluesky posts are limited to 300 characters; this post has ${richText.graphemeLength}.`);
  return richText;
}

export async function publishBlueskyPost(userId: string, text: string) {
  const status = await getBlueskyStatus(userId);
  if (!status.connected || !status.did) throw new Error(status.lastError ?? "Bluesky is not connected.");
  const session = await (await getBlueskyOAuthClient()).restore(status.did);
  const agent = new Agent(session);
  const richText = validateBlueskyText(text);
  await richText.detectFacets(agent);
  return agent.post({ text: richText.text, facets: richText.facets, createdAt: new Date().toISOString() });
}
