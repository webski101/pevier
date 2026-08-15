import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAuditChain, type ChainedAuditRecord } from "@/lib/audit";
import { getCurrentUser } from "@/lib/session";

function parsePolicyResults(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as Array<{ passed?: boolean }> : [];
  }
  catch { return []; }
}

const toChain = (records: Awaited<ReturnType<typeof db.auditRecord.findMany>>): ChainedAuditRecord[] => records.map((record) => ({
  id: record.id, timestamp: record.timestamp, actor: record.actor, userId: record.userId, agentId: record.agentId, channelId: record.channelId,
  platform: record.platform, action: record.action, decision: record.decision, riskScore: record.riskScore,
  policyResults: parsePolicyResults(record.policyResultsJson), previousHash: record.previousHash, hash: record.hash,
}));

async function auditResponse(userId: string | null, simulateTampering = false) {
  const records = userId ? await db.auditRecord.findMany({ where: { userId }, orderBy: { timestamp: "asc" } }) : [];
  const chain = toChain(records);
  const simulatedIndex = simulateTampering && chain.length ? Math.min(12, chain.length - 1) : -1;
  if (simulatedIndex >= 0) chain[simulatedIndex] = { ...chain[simulatedIndex], action: `${chain[simulatedIndex].action}_MODIFIED` };
  const simulatedRecordId = simulatedIndex >= 0 ? chain[simulatedIndex].id : null;
  const channelIds = [...new Set(records.map((record) => record.channelId).filter((id): id is string => Boolean(id)))];
  const channels = channelIds.length ? await db.channel.findMany({ where: { id: { in: channelIds } } }) : [];
  const channelNames = new Map(channels.map((channel) => [channel.id, channel.name]));
  return NextResponse.json({
    records: [...records].reverse().map((record) => {
      const policyResults = parsePolicyResults(record.policyResultsJson);
      return {
        id: record.id,
        timestamp: record.timestamp.toISOString(),
        actor: record.actor,
        agentId: record.agentId,
        channelId: record.channelId,
        channelName: record.channelId ? channelNames.get(record.channelId) ?? record.channelId : null,
        platform: record.platform,
        action: record.id === simulatedRecordId ? `${record.action}_MODIFIED` : record.action,
        decision: record.decision,
        riskScore: record.riskScore,
        violationCount: policyResults.filter((result) => result.passed === false).length,
        previousHash: record.previousHash,
        hash: record.hash,
      };
    }),
    verification: verifyAuditChain(chain),
    simulatedTampering: simulateTampering,
  }, { headers: { "cache-control": "no-store" } });
}

export async function GET() {
  const user = await getCurrentUser();
  return auditResponse(user?.id ?? null);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to verify your audit evidence." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  return auditResponse(user.id, body.action === "tamper");
}
