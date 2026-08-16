import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";

function configuredKey() {
  return process.env.PEVIER_AGENT_KEY?.trim() ?? "";
}

function isLoopback(request: Request) {
  try {
    const hostname = new URL(request.url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function matchesKey(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hashAgentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAgentToken() {
  const token = `pv_live_${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashAgentToken(token), tokenPrefix: token.slice(0, 15) };
}

export async function getAgentGatewayStatus(userId?: string | null) {
  const accountKeys = userId ? await db.agentCredential.count({ where: { userId, revokedAt: null } }) : 0;
  const localOnly = process.env.NODE_ENV !== "production" && !configuredKey();
  return {
    ready: accountKeys > 0 || localOnly,
    accessMode: accountKeys > 0 ? "ACCOUNT_KEY" as const : localOnly ? "LOCAL_ONLY" as const : "KEY_REQUIRED" as const,
    endpoint: "/api/publish",
    credentialsIsolated: true as const,
    credentialCount: accountKeys,
  };
}

export async function authorizeAgentRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const expected = configuredKey();

  if (process.env.NODE_ENV !== "production" && expected) {
    if (received && matchesKey(received, expected)) return { ok: true as const, userId: null };
    return { ok: false as const, status: 401, error: "Agent authorization failed. Send the configured key as a Bearer token." };
  }

  if (received) {
    const credential = await db.agentCredential.findUnique({ where: { tokenHash: hashAgentToken(received) } });
    if (credential && !credential.revokedAt) {
      await db.agentCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } });
      return { ok: true as const, userId: credential.userId };
    }
  }

  if (process.env.NODE_ENV !== "production" && !expected && isLoopback(request)) {
    return { ok: true as const, userId: null };
  }
  return { ok: false as const, status: 401, error: "Agent authorization failed. Create an account API key in Pevier Settings and send it as a Bearer token." };
}
