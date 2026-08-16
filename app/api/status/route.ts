import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAgentGatewayStatus } from "@/lib/agent-auth";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view control-room status." }, { status: 401 });
  const connections = await db.platformConnection.findMany({ where: { userId: user.id, status: "CONNECTED" } });
  const channelIds = connections.flatMap((connection) => connection.channelId ? [connection.channelId] : []);
  const [agents, pending, lastDecision] = await Promise.all([
    db.agent.findMany({ where: { channels: { some: { id: { in: channelIds } } } }, select: { id: true, state: true, risk: true } }),
    user ? db.post.count({ where: { userId: user.id, status: { in: ["PENDING", "HOLD"] } } }) : 0,
    user ? db.auditRecord.findFirst({ where: { userId: user.id }, orderBy: { timestamp: "desc" }, select: { id: true, timestamp: true, agentId: true, channelId: true, action: true, decision: true, riskScore: true } }) : null,
  ]);
  return NextResponse.json({ portfolio: agents.some((agent) => agent.state !== "RUNNING") ? "ATTENTION" : "RUNNING", agents, pending, mode: connections.some((connection) => connection.mode === "LIVE") ? "LIVE" : "DRY_RUN", connected: connections.length > 0, connectedPlatforms: connections.map((connection) => connection.platform), agentGateway: { ...await getAgentGatewayStatus(user.id), lastDecision } }, { headers: { "cache-control": "no-store" } });
}
