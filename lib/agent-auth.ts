import { timingSafeEqual } from "node:crypto";

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

export function getAgentGatewayStatus() {
  const keyed = Boolean(configuredKey());
  const localOnly = !keyed && process.env.NODE_ENV !== "production";
  return {
    ready: keyed || localOnly,
    accessMode: keyed ? "KEY_PROTECTED" as const : localOnly ? "LOCAL_ONLY" as const : "KEY_REQUIRED" as const,
    endpoint: "/api/publish",
    credentialsIsolated: true as const,
  };
}

export function authorizeAgentRequest(request: Request) {
  const expected = configuredKey();
  if (!expected) {
    if (process.env.NODE_ENV !== "production" && isLoopback(request)) return { ok: true as const };
    return { ok: false as const, status: 503, error: "Set PEVIER_AGENT_KEY before accepting agent requests outside local development." };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const received = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!received || !matchesKey(received, expected)) {
    return { ok: false as const, status: 401, error: "Agent authorization failed. Send the configured key as a Bearer token." };
  }
  return { ok: true as const };
}
