import type { Decision, PolicyResult, Severity } from "./types";

const weights: Record<string, number> = {
  CROSS_CHANNEL_DUPLICATION: 30,
  REPETITIVE_TEMPLATE_PATTERN: 20,
  AI_SENSITIVE_PERSONA: 25,
  DISCLOSURE_REQUIRED: 15,
  CADENCE_ANOMALY: 10,
};

export function calculateRisk(results: PolicyResult[]) {
  const numericScore = Math.round(results.reduce((sum, item) => sum + (item.score / 100) * (weights[item.policyId] ?? 0), 0));
  const criticalOverride = results.some((item) => item.decision === "BLOCK" && item.severity === "CRITICAL");
  const score = criticalOverride ? Math.max(88, numericScore) : Math.min(100, numericScore);
  const level: Severity = score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
  const decision: Decision = criticalOverride || results.some((item) => item.decision === "BLOCK")
    ? "BLOCK"
    : results.some((item) => item.decision === "HOLD") ? "HOLD" : "ALLOW";
  return { score, level, decision };
}
