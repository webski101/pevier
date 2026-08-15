import { createHash } from "node:crypto";

export interface AuditPayload {
  id: string;
  timestamp: string | Date;
  actor: string;
  userId?: string | null;
  agentId?: string | null;
  channelId?: string | null;
  platform?: string | null;
  action: string;
  decision?: string | null;
  riskScore?: number | null;
  policyResults?: unknown;
  previousHash: string;
}

export interface ChainedAuditRecord extends AuditPayload { hash: string }

const canonical = (payload: AuditPayload) => JSON.stringify({
  id: payload.id,
  timestamp: new Date(payload.timestamp).toISOString(),
  actor: payload.actor,
  userId: payload.userId ?? null,
  agentId: payload.agentId ?? null,
  channelId: payload.channelId ?? null,
  platform: payload.platform ?? null,
  action: payload.action,
  decision: payload.decision ?? null,
  riskScore: payload.riskScore ?? null,
  policyResults: payload.policyResults ?? [],
  previousHash: payload.previousHash,
});

export function hashAuditRecord(payload: AuditPayload): string {
  return createHash("sha256").update(canonical(payload)).digest("hex");
}

export function buildAuditChain(inputs: Omit<AuditPayload, "previousHash">[]): ChainedAuditRecord[] {
  let previousHash = "GENESIS";
  return inputs.map((input) => {
    const payload: AuditPayload = { ...input, previousHash };
    const record = { ...payload, hash: hashAuditRecord(payload) };
    previousHash = record.hash;
    return record;
  });
}

export function verifyAuditChain(records: ChainedAuditRecord[]) {
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const expectedPrevious = index === 0 ? "GENESIS" : records[index - 1].hash;
    if (record.previousHash !== expectedPrevious) return { valid: false, index, reason: "BROKEN_LINK" as const };
    const { hash, ...payload } = record;
    if (hashAuditRecord(payload) !== hash) return { valid: false, index, reason: "HASH_MISMATCH" as const };
  }
  return { valid: true, checked: records.length };
}
