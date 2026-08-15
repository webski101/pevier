import { describe, expect, it } from "vitest";
import { evaluatePolicies } from "../lib/policies";
import { calculateRisk } from "../lib/risk";
import type { HistoricalPost, PublishRequest } from "../lib/types";

const clean: PublishRequest = { agentId: "agent-1", channelId: "channel-1", platform: "mock", title: "Original climate research digest", contentText: "A sourced weekly summary of new climate research." };
const history: HistoricalPost[] = [
  { id: "1", agentId: "agent-1", channelId: "channel-2", title: "Five AI tools you need now", contentText: "Five AI tools you need in 2026 for investing and market returns", createdAt: new Date() },
  { id: "2", agentId: "agent-1", channelId: "channel-3", title: "Five AI tools you need now", contentText: "Five AI tools you need in 2026 for investing and market returns", createdAt: new Date() },
];

const evaluate = (request: PublishRequest, items = history) => calculateRisk(evaluatePolicies({ request, history: items, attemptsLastHour: 2, channelDailyBaseline: 5 }));

describe("policy engine", () => {
  it("allows a clean post", () => expect(evaluate(clean, []).decision).toBe("ALLOW"));
  it("holds a repetitive post", () => {
    const repetitiveHistory = [{ ...history[0], channelId: "channel-1", title: "Weekly AI roundup episode 8" }];
    expect(evaluate({ ...clean, title: "Weekly AI roundup episode 9" }, repetitiveHistory).decision).toBe("HOLD");
  });
  it("blocks a critical violation", () => expect(evaluate({ ...clean, title: "Five AI tools you need now", contentText: "Five AI tools you need in 2026 for investing and market returns", syntheticMedia: true }).decision).toBe("BLOCK"));
});
