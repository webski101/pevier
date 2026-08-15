import type { Decision, PolicyContext, PolicyResult, Severity } from "./types";
import { textSimilarity } from "./similarity";

export interface PolicyDefinition {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  enabled: boolean;
  evaluator: (context: PolicyContext) => PolicyResult;
}

const result = (
  policy: Pick<PolicyDefinition, "id" | "name" | "severity">,
  passed: boolean,
  score: number,
  decision: Decision,
  reason: string,
  evidence?: Record<string, unknown>,
): PolicyResult => ({ policyId: policy.id, name: policy.name, severity: policy.severity, passed, score, decision, reason, evidence });

const crossChannel: PolicyDefinition = {
  id: "CROSS_CHANNEL_DUPLICATION",
  name: "Cross-channel similarity",
  description: "Detects substantially similar content across the managed portfolio.",
  severity: "CRITICAL",
  enabled: true,
  evaluator: (context) => {
    const current = `${context.request.title} ${context.request.contentText}`;
    const matches = context.history
      .filter((post) => post.channelId !== context.request.channelId)
      .map((post) => ({ channelId: post.channelId, score: textSimilarity(current, `${post.title} ${post.contentText}`) }))
      .filter((match) => match.score >= 0.55)
      .sort((a, b) => b.score - a.score);
    const max = matches[0]?.score ?? 0;
    const uniqueChannels = new Set(matches.filter((match) => match.score >= 0.75).map((match) => match.channelId)).size;
    const threshold = context.thresholds?.[crossChannel.id] ?? { warnAt: 0.65, holdAt: 0.75, blockAt: 0.88 };
    let decision: Decision = "ALLOW";
    if (max >= (threshold.blockAt ?? 0.88) && uniqueChannels >= 2) decision = "BLOCK";
    else if (max >= (threshold.holdAt ?? 0.75)) decision = "HOLD";
    return result(crossChannel, decision === "ALLOW", Math.round(max * 100), decision,
      decision === "ALLOW" ? "No portfolio-wide duplicate pattern detected." : `${uniqueChannels} channels share substantially similar content.`,
      { currentSimilarity: max, uniqueChannels, matches: matches.slice(0, 3) });
  },
};

const repetitiveTemplate: PolicyDefinition = {
  id: "REPETITIVE_TEMPLATE_PATTERN",
  name: "Repetitive template pattern",
  description: "Compares a channel’s recent titles, hooks, and structure.",
  severity: "HIGH",
  enabled: true,
  evaluator: (context) => {
    const recent = context.history.filter((post) => post.channelId === context.request.channelId).slice(-8);
    const scores = recent.map((post) => textSimilarity(context.request.title, post.title));
    const score = scores.length ? Math.max(...scores) : 0;
    const threshold = context.thresholds?.[repetitiveTemplate.id]?.holdAt ?? 0.75;
    const decision: Decision = score >= threshold ? "HOLD" : "ALLOW";
    return result(repetitiveTemplate, decision === "ALLOW", Math.round(score * 100), decision,
      decision === "ALLOW" ? "Channel structure remains within its normal range." : "Recent titles use the same hook and structure.",
      { sampleSize: recent.length, threshold });
  },
};

const sensitivePersona: PolicyDefinition = {
  id: "AI_SENSITIVE_PERSONA",
  name: "AI sensitive-persona guard",
  description: "Blocks synthetic presenters giving financial, health, or legal guidance.",
  severity: "CRITICAL",
  enabled: true,
  evaluator: (context) => {
    const text = `${context.request.title} ${context.request.description ?? ""} ${context.request.contentText}`.toLowerCase();
    const topics = {
      "Financial advice": ["invest", "stock", "crypto", "financial", "returns", "portfolio", "loan"],
      "Health advice": ["diagnosis", "treatment", "medicine", "symptom", "health", "dose"],
      "Legal advice": ["lawsuit", "legal advice", "contract", "attorney", "court"],
    };
    const topic = Object.entries(topics).find(([, words]) => words.some((word) => text.includes(word)))?.[0];
    const unsafe = Boolean(context.request.syntheticMedia && topic);
    return result(sensitivePersona, !unsafe, unsafe ? 100 : 0, unsafe ? "BLOCK" : "ALLOW",
      unsafe ? `Synthetic presenter detected on ${topic?.toLowerCase()}.` : "No sensitive synthetic-persona combination detected.",
      { syntheticPresenter: Boolean(context.request.syntheticMedia), topic: topic ?? "General" });
  },
};

const disclosure: PolicyDefinition = {
  id: "DISCLOSURE_REQUIRED",
  name: "Transparency and disclosure",
  description: "Signals when synthetic public-interest media needs review or disclosure.",
  severity: "HIGH",
  enabled: true,
  evaluator: (context) => {
    const attached = Boolean(context.request.platformDisclosureEnabled || context.request.customDisclosureAttached);
    const needsReview = Boolean(context.request.syntheticMedia && context.request.publicInterestTopic && !attached && !context.request.humanEditorialReview);
    return result(disclosure, !needsReview, needsReview ? 80 : 0, needsReview ? "HOLD" : "ALLOW",
      needsReview ? "Synthetic public-interest media has no disclosure or human review." : "Disclosure inputs satisfy the configured policy.",
      { syntheticMedia: Boolean(context.request.syntheticMedia), publicInterestTopic: Boolean(context.request.publicInterestTopic), disclosureAttached: attached });
  },
};

const cadence: PolicyDefinition = {
  id: "CADENCE_ANOMALY",
  name: "Upload cadence anomaly",
  description: "Compares current velocity with the channel and agent baseline.",
  severity: "HIGH",
  enabled: true,
  evaluator: (context) => {
    const limit = Math.max(12, context.channelDailyBaseline * 3);
    const anomalous = context.attemptsLastHour > limit;
    const score = anomalous ? Math.min(100, Math.round((context.attemptsLastHour / limit) * 75)) : Math.round((context.attemptsLastHour / limit) * 40);
    return result(cadence, !anomalous, score, anomalous ? "HOLD" : "ALLOW",
      anomalous ? `${context.attemptsLastHour} attempts in 60 minutes exceed the channel baseline.` : "Publishing velocity is within the expected range.",
      { attemptsLastHour: context.attemptsLastHour, normalDailyRange: `3–${context.channelDailyBaseline}` });
  },
};

export const policyDefinitions: PolicyDefinition[] = [crossChannel, repetitiveTemplate, sensitivePersona, disclosure, cadence];

export function evaluatePolicies(context: PolicyContext, enabledIds?: Set<string>): PolicyResult[] {
  return policyDefinitions
    .filter((policy) => policy.enabled && (!enabledIds || enabledIds.has(policy.id)))
    .map((policy) => policy.evaluator(context));
}
