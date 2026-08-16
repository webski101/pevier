import { randomUUID } from "node:crypto";
import { db } from "./db";
import { evaluatePolicies } from "./policies";
import { calculateRisk } from "./risk";
import { getAdapter } from "./adapters";
import { resolveYouTubeMode } from "./youtube";
import { resolveInstagramMode } from "./instagram";
import { resolveBlueskyMode } from "./bluesky";
import { hashAuditRecord } from "./audit";
import { buildRemediationPlan } from "./remediation";
import type { GatewayResult, HistoricalPost, PlatformDelivery, PlatformMode, PublishRequest } from "./types";

export async function evaluatePublishRequest(request: PublishRequest, overrides?: {
  history?: HistoricalPost[];
  attemptsLastHour?: number;
  baseline?: number;
  persist?: boolean;
  delivery?: PlatformDelivery;
}): Promise<GatewayResult> {
  const persist = overrides?.persist ?? true;
  const userId = overrides?.delivery?.youtube?.userId ?? overrides?.delivery?.instagram?.userId ?? overrides?.delivery?.bluesky?.userId ?? null;
  const ownerWhere = { userId };
  const storedPosts = overrides?.history ? [] : await db.post.findMany({
    where: { ...ownerWhere, status: "LIVE_PUBLISHED" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const history: HistoricalPost[] = overrides?.history ?? storedPosts.map((post) => ({
    id: post.id, agentId: post.agentId, channelId: post.channelId, title: post.title, contentText: post.contentText, createdAt: post.createdAt,
  }));
  const since = new Date(Date.now() - 3_600_000);
  const attemptsLastHour = overrides?.attemptsLastHour ?? await db.post.count({ where: { userId, agentId: request.agentId, createdAt: { gte: since } } });
  const settings = persist && userId ? await db.policySetting.findMany({ where: { userId } }) : [];
  const enabledIds = settings.length ? new Set(settings.filter((setting) => setting.enabled).map((setting) => setting.policyId)) : undefined;
  const thresholds = Object.fromEntries(settings.map((setting) => [setting.policyId, { warnAt: setting.warnAt ?? undefined, holdAt: setting.holdAt ?? undefined, blockAt: setting.blockAt ?? undefined }]));
  const policyResults = evaluatePolicies({ request, history, attemptsLastHour, channelDailyBaseline: overrides?.baseline ?? 5, thresholds }, enabledIds);
  const risk = calculateRisk(policyResults);
  const decisionId = `PV-${randomUUID().slice(0, 8).toUpperCase()}`;
  const configuredMode = (process.env.PEVIER_PUBLISH_MODE ?? "DRY_RUN") as PlatformMode;
  const mode = request.platform === "youtube"
    ? await resolveYouTubeMode(overrides?.delivery?.youtube?.userId)
    : request.platform === "instagram"
      ? await resolveInstagramMode(overrides?.delivery?.instagram?.userId)
      : request.platform === "bluesky"
        ? await resolveBlueskyMode(overrides?.delivery?.bluesky?.userId)
        : configuredMode;
  const adapter = getAdapter(request.platform, mode);
  let publication: GatewayResult["publication"] = { published: false, mode, reason: risk.decision === "ALLOW" ? "NOT_ATTEMPTED" : "POLICY_REJECTED" };
  if (risk.decision === "ALLOW") {
    try {
      publication = await adapter.publish(request, overrides?.delivery);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Platform publication failed.";
      console.error("[publish-gateway] platform adapter failed", { decisionId, platform: request.platform, reason });
      publication = { published: false, mode, reason };
    }
  }
  const auditAction = publication.published ? "PUBLISH_COMPLETED" : risk.decision === "ALLOW" && mode === "LIVE" && publication.reason !== "VIDEO_REQUIRED" ? "PUBLISH_FAILED" : "PUBLISH_EVALUATED";
  const postStatus = risk.decision !== "ALLOW" ? risk.decision : publication.published ? "LIVE_PUBLISHED" : mode !== "LIVE" ? "DRY_RUN_PUBLISHED" : publication.reason === "VIDEO_REQUIRED" ? "AWAITING_MEDIA" : "PUBLISH_FAILED";

  const timestamp = new Date();
  const lastAudit = persist ? await db.auditRecord.findFirst({ where: ownerWhere, orderBy: { timestamp: "desc" } }) : null;
  const previousHash = lastAudit?.hash ?? "GENESIS";
  const auditPayload = {
    id: randomUUID(), timestamp, actor: "publish-gateway", userId, agentId: request.agentId, channelId: request.channelId,
    platform: request.platform, action: auditAction, decision: risk.decision, riskScore: risk.score, policyResults, previousHash,
  };
  const auditHash = hashAuditRecord(auditPayload);

  if (persist) {
    await db.$transaction(async (tx) => {
      await tx.post.create({ data: {
        id: decisionId, title: request.title, description: request.description ?? "", contentText: request.contentText,
        platform: request.platform, status: postStatus,
        decision: risk.decision, riskScore: risk.score, syntheticMedia: request.syntheticMedia ?? false,
        targetRegionsJson: JSON.stringify(request.targetRegions ?? []), policyResultsJson: JSON.stringify(policyResults),
        scheduledAt: request.scheduledAt ? new Date(request.scheduledAt) : null, agentId: request.agentId, channelId: request.channelId, userId,
      } });
      await tx.auditRecord.create({ data: {
        id: auditPayload.id, timestamp, actor: auditPayload.actor, agentId: request.agentId, channelId: request.channelId,
        platform: request.platform, action: auditPayload.action, decision: risk.decision, riskScore: risk.score,
        policyResultsJson: JSON.stringify(policyResults), previousHash, hash: auditHash, userId,
      } });
      if (risk.decision === "BLOCK") {
        await tx.agent.update({ where: { id: request.agentId }, data: { state: "HALTED", risk: risk.score, blocks: { increment: 1 } } });
        await tx.circuitState.upsert({ where: { scope_scopeId: { scope: "agent", scopeId: request.agentId } },
          update: { state: "HALTED", reason: "Critical policy threshold exceeded" },
          create: { id: randomUUID(), scope: "agent", scopeId: request.agentId, state: "HALTED", reason: "Critical policy threshold exceeded" } });
        await tx.incident.create({ data: {
          id: `INC-${Date.now().toString().slice(-6)}`, title: "Automated publishing threat contained", severity: "CRITICAL",
          source: request.agentId, affectedPosts: 1, affectedChannels: 1, action: "Agent halted automatically", status: "Contained",
          timelineJson: JSON.stringify([[timestamp.toISOString(), "Policy threshold exceeded"], [timestamp.toISOString(), `${request.agentId} HALTED`]]), userId,
        } });
      }
    });
  }

  return {
    decision: risk.decision, riskScore: risk.score, riskLevel: risk.level,
    violations: policyResults.filter((item) => !item.passed), policyResults,
    remediation: buildRemediationPlan(risk.decision, policyResults.filter((item) => !item.passed)),
    decisionId, auditHash, publisherMode: mode, publication,
  };
}
