import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentGatewayStatus } from "@/lib/agent-auth";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  const connection = user ? await db.platformConnection.findUnique({ where: { userId_platform: { userId: user.id, platform: "youtube" } } }) : null;
  const channel = connection?.channelId ? await db.channel.findUnique({ where: { id: connection.channelId } }) : null;
  const [agents, pending, lastDecision] = await Promise.all([
    channel ? db.agent.findMany({ where: { id: channel.agentId }, select: { id: true, state: true, risk: true } }) : [],
    user ? db.post.count({ where: { userId: user.id, status: { in: ["PENDING", "HOLD"] } } }) : 0,
    user ? db.auditRecord.findFirst({ where: { userId: user.id }, orderBy: { timestamp: "desc" }, select: { id: true, timestamp: true, agentId: true, channelId: true, action: true, decision: true, riskScore: true } }) : null,
  ]);
  return NextResponse.json({ portfolio: "RUNNING", agents, pending, mode: connection?.mode ?? "DRY_RUN", agentGateway: { ...getAgentGatewayStatus(), lastDecision } }, { headers: { "cache-control": "no-store" } });
}
