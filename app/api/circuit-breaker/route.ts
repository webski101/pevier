import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { transitionCircuit } from "@/lib/circuit-breaker";
import { hashAuditRecord } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";
import { getYouTubeStatus } from "@/lib/youtube";
import type { CircuitStatus } from "@/lib/types";

const schema = z.object({ scope: z.enum(["portfolio", "agent", "channel", "platform"]), scopeId: z.string(), state: z.enum(["RUNNING", "PAUSED", "HALTED", "KILLED"]), reason: z.string().optional() });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user && process.env.NODE_ENV === "production") return NextResponse.json({ error: "Sign in before changing a circuit." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Circuit transition failed validation." }, { status: 400 });
  if (user) {
    const youtube = await getYouTubeStatus(user.id);
    const ownsScope = (parsed.data.scope === "agent" && parsed.data.scopeId === youtube.agentId)
      || (parsed.data.scope === "channel" && parsed.data.scopeId === youtube.channelId);
    if (!ownsScope) return NextResponse.json({ error: "That circuit does not belong to the signed-in user." }, { status: 403 });
  }
  const current = await db.circuitState.findUnique({ where: { scope_scopeId: { scope: parsed.data.scope, scopeId: parsed.data.scopeId } } });
  try {
    const next = transitionCircuit((current?.state ?? "RUNNING") as CircuitStatus, parsed.data.state);
    const timestamp = new Date();
    const last = await db.auditRecord.findFirst({ where: { userId: user?.id ?? null }, orderBy: { timestamp: "desc" } });
    const payload = { id: randomUUID(), timestamp, actor: "operator", userId: user?.id ?? null, action: "CIRCUIT_TRANSITION", decision: next, riskScore: null, previousHash: last?.hash ?? "GENESIS", policyResults: [], agentId: parsed.data.scope === "agent" ? parsed.data.scopeId : null };
    const hash = hashAuditRecord(payload);
    await db.$transaction([
      db.circuitState.upsert({ where: { scope_scopeId: { scope: parsed.data.scope, scopeId: parsed.data.scopeId } }, update: { state: next, reason: parsed.data.reason }, create: { id: randomUUID(), scope: parsed.data.scope, scopeId: parsed.data.scopeId, state: next, reason: parsed.data.reason } }),
      db.auditRecord.create({ data: { id: payload.id, timestamp, actor: payload.actor, action: payload.action, decision: next, policyResultsJson: "[]", previousHash: payload.previousHash, hash, agentId: payload.agentId, userId: payload.userId } }),
    ]);
    return NextResponse.json({ previous: current?.state ?? "RUNNING", state: next, auditHash: hash });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid transition" }, { status: 409 });
  }
}
