import { afterEach, describe, expect, it } from "vitest";
import { authorizeAgentRequest, getAgentGatewayStatus } from "../lib/agent-auth";

describe("agent gateway authorization", () => {
  afterEach(() => { delete process.env.PEVIER_AGENT_KEY; });

  it("allows a keyless loopback request in local development", () => {
    expect(authorizeAgentRequest(new Request("http://localhost:3000/api/publish"))).toEqual({ ok: true });
    expect(getAgentGatewayStatus().accessMode).toBe("LOCAL_ONLY");
  });

  it("rejects a keyless non-loopback request", () => {
    const result = authorizeAgentRequest(new Request("https://pevier.example/api/publish"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it("requires an exact bearer key when configured", () => {
    process.env.PEVIER_AGENT_KEY = "agent-secret";
    expect(authorizeAgentRequest(new Request("http://localhost:3000/api/publish", { headers: { authorization: "Bearer wrong" } })).ok).toBe(false);
    expect(authorizeAgentRequest(new Request("http://localhost:3000/api/publish", { headers: { authorization: "Bearer agent-secret" } }))).toEqual({ ok: true });
    expect(getAgentGatewayStatus().accessMode).toBe("KEY_PROTECTED");
  });
});
