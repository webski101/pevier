import { describe, expect, it } from "vitest";
import { containBlastRadius, transitionCircuit } from "../lib/circuit-breaker";

describe("circuit breaker", () => {
  it.each([["RUNNING", "PAUSED"], ["PAUSED", "RUNNING"], ["RUNNING", "HALTED"], ["HALTED", "RUNNING"], ["RUNNING", "KILLED"], ["PAUSED", "KILLED"], ["HALTED", "KILLED"]] as const)("transitions %s → %s", (from, to) => expect(transitionCircuit(from, to)).toBe(to));
  it("isolates one risky agent", () => {
    const result = containBlastRadius("agent-3", ["c1", "c2"], ["c1", "c2", "c3", "c4"]);
    expect(result.agentState).toBe("HALTED"); expect(result.portfolioState).toBe("RUNNING"); expect(result.unaffectedChannels).toEqual(["c3", "c4"]);
  });
});
