import { describe, expect, it } from "vitest";
import { buildAuditChain, verifyAuditChain } from "../lib/audit";

const make = () => buildAuditChain([0, 1, 2].map((index) => ({ id: String(index), timestamp: new Date(2026, 0, 1, 0, index), actor: "test", action: "EVALUATE", decision: "ALLOW", riskScore: index, policyResults: [] })));
describe("hash chain", () => {
  it("accepts a valid chain", () => expect(verifyAuditChain(make()).valid).toBe(true));
  it("rejects a modified record", () => { const chain = make(); chain[1].action = "MODIFIED"; expect(verifyAuditChain(chain).valid).toBe(false); });
  it("rejects a broken previous hash", () => { const chain = make(); chain[2].previousHash = "BROKEN"; expect(verifyAuditChain(chain).valid).toBe(false); });
  it("seals record ownership into the hash", () => { const chain = make(); chain[1].userId = "another-user"; expect(verifyAuditChain(chain).valid).toBe(false); });
});
