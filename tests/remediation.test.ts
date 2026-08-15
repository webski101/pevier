import { describe, expect, it } from "vitest";
import { buildRemediationPlan } from "../lib/remediation";
import type { PolicyResult } from "../lib/types";

const violation = (policyId: string, decision: "HOLD" | "BLOCK" = "HOLD"): PolicyResult => ({
  policyId,
  name: policyId,
  severity: "HIGH",
  passed: false,
  score: 80,
  decision,
  reason: "Policy stopped the request.",
});

describe("remediation plans", () => {
  it("allows one automatic retry for a repetitive-title hold", () => {
    const plan = buildRemediationPlan("HOLD", [violation("REPETITIVE_TEMPLATE_PATTERN")]);
    expect(plan.autoRetryAllowed).toBe(true);
    expect(plan.maxAutomaticRetries).toBe(1);
  });

  it("requires a person when any hold is not safely correctable", () => {
    const plan = buildRemediationPlan("HOLD", [violation("REPETITIVE_TEMPLATE_PATTERN"), violation("DISCLOSURE_REQUIRED")]);
    expect(plan.autoRetryAllowed).toBe(false);
    expect(plan.actions[1].instruction).toContain("genuine human editorial review");
  });

  it("never retries a block automatically", () => {
    expect(buildRemediationPlan("BLOCK", [violation("AI_SENSITIVE_PERSONA", "BLOCK")]).autoRetryAllowed).toBe(false);
  });
});
