const title = process.argv[2]?.trim();
const contentText = process.argv[3]?.trim();
if (!title || !contentText) {
  console.error('Usage: npm run agent:publish -- "Post title" "Post content"');
  process.exit(1);
}

const baseUrl = (process.env.PEVIER_URL ?? "http://localhost:3000").replace(/\/$/, "");
const agentKey = process.env.PEVIER_ACCOUNT_KEY?.trim();
const agentId = process.env.PEVIER_AGENT_ID?.trim();
const channelId = process.env.PEVIER_CHANNEL_ID?.trim();
if (!agentKey || !agentId || !channelId) {
  console.error("Set PEVIER_ACCOUNT_KEY, PEVIER_AGENT_ID, and PEVIER_CHANNEL_ID from Pevier Settings before publishing.");
  process.exit(1);
}

async function readJson(path, init) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error(`Pevier is not reachable at ${baseUrl}.`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = payload.error ?? payload.publication?.reason;
    throw new Error(reason ? `Pevier returned HTTP ${response.status}: ${reason}` : `Pevier returned HTTP ${response.status}.`);
  }
  return payload;
}

function printResult(result) {
  console.log(`Decision: ${result.decision} · risk ${result.riskScore}/100 · ${result.riskLevel}`);
  for (const violation of result.violations ?? []) console.log(`Policy stop: ${violation.policyId} · ${violation.reason}`);
  for (const action of result.remediation?.actions ?? []) console.log(`Required action: ${action.instruction}`);
  console.log(`Evidence: ${result.decisionId} · ${result.auditHash.slice(0, 12)}…`);
  if (result.publication?.published) console.log(`Platform result: published as ${result.publication.externalId}`);
  else console.log(`Platform result: ${result.publication?.reason ?? result.publisherMode}`);
}

async function main() {
  const payload = {
    agentId,
    channelId,
    platform: "instagram",
    title,
    description: contentText,
    contentText,
    syntheticMedia: false,
    publicInterestTopic: false,
    humanEditorialReview: true,
    platformDisclosureEnabled: true,
  };

  console.log(`\nPevier production agent → ${baseUrl}/api/publish`);
  const result = await readJson("/api/publish", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${agentKey}` }, body: JSON.stringify(payload) });
  printResult(result);
  console.log("Instagram credentials remained inside Pevier.\n");
}

main().catch((error) => {
  console.error(`Agent request failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
});
