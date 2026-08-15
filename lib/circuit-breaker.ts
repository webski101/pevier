import type { CircuitStatus } from "./types";

const allowed: Record<CircuitStatus, CircuitStatus[]> = {
  RUNNING: ["PAUSED", "HALTED", "KILLED"],
  PAUSED: ["RUNNING", "HALTED", "KILLED"],
  HALTED: ["RUNNING", "KILLED"],
  KILLED: [],
};

export function transitionCircuit(current: CircuitStatus, next: CircuitStatus): CircuitStatus {
  if (current === next) return current;
  if (!allowed[current].includes(next)) throw new Error(`Invalid circuit transition: ${current} → ${next}`);
  return next;
}

export function containBlastRadius(agentId: string, channelIds: string[], allChannelIds: string[]) {
  const affected = new Set(channelIds);
  return {
    agentId,
    agentState: "HALTED" as const,
    portfolioState: "RUNNING" as const,
    affectedChannels: channelIds,
    unaffectedChannels: allChannelIds.filter((id) => !affected.has(id)),
  };
}
