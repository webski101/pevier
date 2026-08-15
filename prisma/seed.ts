import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { buildAuditChain } from "../lib/audit";
import { demoAgents, demoChannels, demoIncident, historicalPosts, queuedPosts } from "../lib/demo-data";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditRecord.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.post.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.circuitState.deleteMany();
  await prisma.policySetting.deleteMany();

  for (const agent of demoAgents) await prisma.agent.create({ data: agent });
  for (const channel of demoChannels) await prisma.channel.create({ data: channel });
  for (const post of historicalPosts) await prisma.post.create({ data: {
    id: post.id, title: post.title, contentText: post.contentText, description: "Editorially reviewed demo content.",
    platform: demoChannels.find((channel) => channel.id === post.channelId)?.platform ?? "mock", status: "PUBLISHED",
    decision: "ALLOW", riskScore: 8 + (Number(post.id.slice(-2)) % 22), agentId: post.agentId, channelId: post.channelId, createdAt: post.createdAt,
  } });
  for (const queued of queuedPosts) await prisma.post.create({ data: {
    id: queued.id, title: queued.title, contentText: `Queued demo publication: ${queued.title}`,
    platform: queued.platform, status: queued.decision, decision: queued.decision === "HOLD" ? "HOLD" : null,
    riskScore: queued.risk, agentId: queued.agentId, channelId: queued.channelId, scheduledAt: new Date(Date.now() + 3_600_000),
  } });

  const { timeline, ...incident } = demoIncident;
  await prisma.incident.create({ data: { ...incident, timelineJson: JSON.stringify(timeline) } });
  const policyRows = [
    ["CROSS_CHANNEL_DUPLICATION", 0.65, 0.75, 0.88],
    ["REPETITIVE_TEMPLATE_PATTERN", 0.6, 0.75, null],
    ["AI_SENSITIVE_PERSONA", null, null, 1],
    ["DISCLOSURE_REQUIRED", 0.5, 0.75, null],
    ["CADENCE_ANOMALY", 0.6, 0.8, null],
  ] as const;
  for (const [policyId, warnAt, holdAt, blockAt] of policyRows) await prisma.policySetting.create({ data: { policyId, enabled: true, warnAt, holdAt, blockAt } });

  const now = Date.now();
  const chain = buildAuditChain(Array.from({ length: 26 }, (_, index) => ({
    id: randomUUID(), timestamp: new Date(now - (26 - index) * 240_000), actor: index % 5 === 0 ? "policy-engine" : "publish-gateway",
    agentId: demoAgents[index % demoAgents.length].id, channelId: demoChannels[index % demoChannels.length].id,
    platform: demoChannels[index % demoChannels.length].platform, action: index % 6 === 0 ? "CIRCUIT_TRANSITION" : "PUBLISH_EVALUATED",
    decision: index % 9 === 0 ? "HOLD" : "ALLOW", riskScore: 8 + ((index * 11) % 69), policyResults: [],
  })));
  for (const record of chain) await prisma.auditRecord.create({ data: {
    id: record.id, timestamp: new Date(record.timestamp), actor: record.actor, agentId: record.agentId, channelId: record.channelId,
    platform: record.platform, action: record.action, decision: record.decision, riskScore: record.riskScore,
    policyResultsJson: JSON.stringify(record.policyResults), previousHash: record.previousHash, hash: record.hash,
  } });
  await prisma.circuitState.create({ data: { id: randomUUID(), scope: "portfolio", scopeId: "portfolio", state: "RUNNING", reason: "All systems nominal" } });
}

main().finally(() => prisma.$disconnect());
