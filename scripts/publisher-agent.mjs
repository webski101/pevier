import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

const scenario = (process.argv[2] ?? "safe").toLowerCase();
if (!new Set(["safe", "repair", "blocked", "private"]).has(scenario)) {
  console.error("Usage: npm run agent:demo -- safe|repair|blocked|private <video-path> [title]");
  process.exit(1);
}

const baseUrl = (process.env.PEVIER_URL ?? "http://localhost:3000").replace(/\/$/, "");
const agentKey = process.env.PEVIER_AGENT_KEY?.trim();

async function readJson(path, init) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error(`Pevier is not reachable at ${baseUrl}. Start it with npm run dev first.`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = payload.error ?? payload.publication?.reason;
    throw new Error(reason ? `Pevier returned HTTP ${response.status}: ${reason}` : `Pevier returned HTTP ${response.status}.`);
  }
  return payload;
}

async function targetChannel() {
  const youtube = await readJson("/api/platforms/youtube");
  if (youtube.channelId && youtube.agentId) {
    return { agentId: youtube.agentId, channelId: youtube.channelId, channelName: youtube.accountLabel, platform: "youtube", youtubeMode: youtube.mode };
  }

  const portfolio = await readJson("/api/portfolio");
  const channel = portfolio.channels?.find((item) => item.platform === "youtube" && item.agent?.state === "RUNNING")
    ?? portfolio.channels?.find((item) => item.platform === "youtube");
  if (!channel) throw new Error("No YouTube channel is available in Pevier's portfolio.");
  return { agentId: channel.agentId, channelId: channel.id, channelName: channel.name, platform: "youtube", youtubeMode: "DRY_RUN" };
}

const videoMimeTypes = new Map([
  [".avi", "video/x-msvideo"],
  [".mkv", "video/x-matroska"],
  [".mov", "video/quicktime"],
  [".mp4", "video/mp4"],
  [".mpeg", "video/mpeg"],
  [".mpg", "video/mpeg"],
  [".webm", "video/webm"],
]);

async function privateUpload(target, headers, correctedTitle) {
  const videoPath = process.argv[3];
  if (!videoPath) throw new Error('Private upload requires a video path. Example: npm run agent:demo -- private "C:\\Videos\\clip.mp4"');
  if (target.youtubeMode !== "LIVE") throw new Error("Open Pevier Settings and select Live private before running a private upload.");

  const extension = extname(videoPath).toLowerCase();
  const mimeType = videoMimeTypes.get(extension);
  if (!mimeType) throw new Error("Use a supported video file: MP4, MOV, WebM, MPEG, AVI, or MKV.");
  const bytes = await readFile(videoPath).catch(() => { throw new Error(`Video file was not found: ${videoPath}`); });
  if (!bytes.byteLength) throw new Error("The selected video file is empty.");
  if (bytes.byteLength > 128 * 1024 * 1024) throw new Error("The local private-upload pilot accepts videos up to 128 MB.");

  const dispatchId = randomUUID();
  const requestedTitle = process.argv.slice(4).join(" ").trim();
  const fallbackTitle = basename(videoPath, extension).replace(/[_-]+/g, " ").trim() || "Private agent upload";
  const title = (correctedTitle || requestedTitle || fallbackTitle).slice(0, 100);
  const form = new FormData();
  form.set("video", new Blob([bytes], { type: mimeType }), basename(videoPath));
  form.set("agentId", target.agentId);
  form.set("channelId", target.channelId);
  form.set("title", title);
  form.set("description", `Operator-approved private upload ${dispatchId}.`);
  form.set("contentText", `${title}. Unique private dispatch ${dispatchId}, reviewed by the operator before upload.`);
  form.set("syntheticMedia", "false");
  form.set("humanEditorialReview", "true");
  form.set("platformDisclosureEnabled", "true");

  const uploadHeaders = {};
  if (headers.authorization) uploadHeaders.authorization = headers.authorization;
  return { title, result: await readJson("/api/platforms/youtube/upload", { method: "POST", headers: uploadHeaders, body: form }) };
}

function printResult(result, label) {
  if (label) console.log(`\n${label}`);
  console.log(`Decision: ${result.decision} · risk ${result.riskScore}/100 · ${result.riskLevel}`);
  for (const violation of result.violations ?? []) console.log(`Policy stop: ${violation.policyId} · ${violation.reason}`);
  for (const action of result.remediation?.actions ?? []) console.log(`Required action: ${action.instruction}`);
  console.log(`Evidence: ${result.decisionId} · ${result.auditHash.slice(0, 12)}…`);
  if (result.publication?.published) console.log(`Platform result: privately published as ${result.publication.externalId}`);
  else console.log(`Platform result: nothing uploaded (${result.publication?.reason ?? result.publisherMode})`);
}

async function main() {
  const target = await targetChannel();
  const publishTarget = { agentId: target.agentId, channelId: target.channelId, platform: target.platform };
  const requestId = new Date().toISOString();
  const uniqueDispatchId = randomUUID();
  const payload = scenario === "blocked" ? {
    ...publishTarget,
    title: "Guaranteed crypto returns from an AI financial adviser",
    description: "An autonomous synthetic presenter promises guaranteed portfolio returns.",
    contentText: "Synthetic financial adviser recommends crypto investments and guarantees market returns without human review.",
    syntheticMedia: true,
    publicInterestTopic: true,
    humanEditorialReview: false,
    platformDisclosureEnabled: false,
    targetRegions: ["NG"],
  } : scenario === "repair" ? {
    ...publishTarget,
    title: "August control-room walkthrough",
    description: "A metadata-only correction-loop test using a deliberately repeated title.",
    contentText: "This request intentionally repeats a recent title so Pevier can instruct the agent and verify one automatic correction retry.",
    syntheticMedia: false,
    publicInterestTopic: false,
    humanEditorialReview: true,
    platformDisclosureEnabled: true,
    targetRegions: ["NG"],
  } : {
    ...publishTarget,
    title: `Operator-reviewed dispatch ${uniqueDispatchId}`,
    description: `A distinct local agent request (${uniqueDispatchId}) sent through the Pevier policy firewall.`,
    contentText: `Original technical observation ${uniqueDispatchId}, prepared at ${requestId}. The operator reviewed this dry-run request before platform handoff.`,
    syntheticMedia: false,
    publicInterestTopic: false,
    humanEditorialReview: true,
    platformDisclosureEnabled: true,
    targetRegions: ["NG"],
  };

  const headers = { "content-type": "application/json" };
  if (agentKey) headers.authorization = `Bearer ${agentKey}`;

  console.log(`\nPevier local agent → ${target.channelName}`);
  console.log(`Scenario: ${scenario.toUpperCase()} · endpoint: ${baseUrl}${scenario === "private" ? "/api/platforms/youtube/upload" : "/api/publish"}`);

  let result;
  let submittedTitle;
  if (scenario === "private") {
    ({ result, title: submittedTitle } = await privateUpload(target, headers));
  } else {
    result = await readJson("/api/publish", { method: "POST", headers, body: JSON.stringify(payload) });
    submittedTitle = payload.title;
  }
  printResult(result);

  if (result.decision === "HOLD" && result.remediation?.autoRetryAllowed) {
    const correctedTitle = `Operator field observation ${randomUUID().slice(0, 8)}: ${submittedTitle}`.slice(0, 100);
    console.log(`\nAgent correction: revised title to "${correctedTitle}"`);
    if (scenario === "private") {
      ({ result } = await privateUpload(target, headers, correctedTitle));
    } else {
      payload.title = correctedTitle;
      payload.contentText = `${correctedTitle}. ${payload.contentText}`;
      result = await readJson("/api/publish", { method: "POST", headers, body: JSON.stringify(payload) });
    }
    printResult(result, "Automatic retry 1/1");
  }
  console.log("Google credentials remained inside Pevier.\n");
}

main().catch((error) => {
  console.error(`Agent request failed: ${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
});
