import type { Decision, PolicyResult, RemediationPlan } from "./types";

const instructions: Record<string, { instruction: string; automaticallyCorrectable: boolean }> = {
  CROSS_CHANNEL_DUPLICATION: {
    instruction: "Create materially different content for this channel; changing only the title is not enough.",
    automaticallyCorrectable: false,
  },
  REPETITIVE_TEMPLATE_PATTERN: {
    instruction: "Replace the title's opening hook and structure with a substantially different formulation.",
    automaticallyCorrectable: true,
  },
  AI_SENSITIVE_PERSONA: {
    instruction: "Remove the synthetic sensitive-advice persona or route the content to qualified human review.",
    automaticallyCorrectable: false,
  },
  DISCLOSURE_REQUIRED: {
    instruction: "Attach the required platform disclosure or obtain genuine human editorial review before resubmitting.",
    automaticallyCorrectable: false,
  },
  CADENCE_ANOMALY: {
    instruction: "Wait for the publishing rate to return within the configured channel baseline.",
    automaticallyCorrectable: false,
  },
};

export function buildRemediationPlan(decision: Decision, violations: PolicyResult[]): RemediationPlan {
  const actions = violations.map((violation) => ({
    policyId: violation.policyId,
    instruction: instructions[violation.policyId]?.instruction ?? "Send this request to an operator for review.",
    automaticallyCorrectable: instructions[violation.policyId]?.automaticallyCorrectable ?? false,
  }));
  const autoRetryAllowed = decision === "HOLD" && actions.length > 0 && actions.every((action) => action.automaticallyCorrectable);
  return {
    required: decision !== "ALLOW",
    autoRetryAllowed,
    maxAutomaticRetries: autoRetryAllowed ? 1 : 0,
    actions,
  };
}
