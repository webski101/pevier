import type { HistoricalPost } from "./types";

export const demoAgents = [
  { id: "research-agent-01", name: "ResearchAgent-01", state: "RUNNING", risk: 12, postsToday: 4, blocks: 0 },
  { id: "studio-agent-02", name: "StudioAgent-02", state: "RUNNING", risk: 24, postsToday: 7, blocks: 1 },
  { id: "shorts-agent-03", name: "ShortsAgent-03", state: "RUNNING", risk: 37, postsToday: 13, blocks: 2 },
  { id: "regional-agent-04", name: "RegionalAgent-04", state: "RUNNING", risk: 18, postsToday: 3, blocks: 0 },
];

const channelSeed = [
  ["channel-01", "AI Daily", "@AIDaily", "youtube", "shorts-agent-03", 12],
  ["channel-02", "Tech Daily", "@TechDaily", "youtube", "shorts-agent-03", 18],
  ["channel-03", "AI Quickies", "@AIQuickies", "instagram", "shorts-agent-03", 21],
  ["channel-04", "Future Byte", "@FutureByte", "youtube", "shorts-agent-03", 16],
  ["channel-05", "FinSmart AI", "@FinSmartAI", "youtube", "shorts-agent-03", 42],
  ["channel-06", "Design Signal", "@DesignSignal", "instagram", "studio-agent-02", 23],
  ["channel-07", "Build Systems", "@BuildSystems", "youtube", "research-agent-01", 9],
  ["channel-08", "Model Notes", "@ModelNotes", "youtube", "research-agent-01", 17],
  ["channel-09", "Creator Ops", "@CreatorOps", "instagram", "studio-agent-02", 28],
  ["channel-10", "Lagos Tech", "@LagosTech", "youtube", "regional-agent-04", 14],
  ["channel-11", "Accra Builds", "@AccraBuilds", "instagram", "regional-agent-04", 19],
  ["channel-12", "Policy Wire", "@PolicyWire", "mock", "research-agent-01", 11],
] as const;

export const demoChannels = channelSeed.map(([id, name, handle, platform, agentId, risk]) => ({ id, name, handle, platform, agentId, risk, state: "RUNNING" }));

const cleanTitles = [
  "A field guide to evaluating small language models",
  "What creators should know about provenance labels",
  "Inside a calm production review",
  "Design systems that survive product growth",
  "How regional teams localize technical stories",
  "The week in open model research",
  "A practical tour of retrieval evaluation",
];

export const historicalPosts: HistoricalPost[] = Array.from({ length: 42 }, (_, index) => {
  const channel = demoChannels[index % demoChannels.length];
  const title = cleanTitles[index % cleanTitles.length];
  return {
    id: `PV-${2700 + index}`,
    agentId: channel.agentId,
    channelId: channel.id,
    title: `${title}${index > 6 ? ` — ${Math.floor(index / 7) + 1}` : ""}`,
    contentText: `Original reporting for ${channel.name}. ${title}. Sources reviewed by the editorial operator before release.`,
    createdAt: new Date(Date.now() - (42 - index) * 3_600_000),
  };
});

export const queuedPosts = Array.from({ length: 15 }, (_, index) => {
  const channel = demoChannels[index % demoChannels.length];
  return {
    id: `PV-${2840 + index}`,
    title: index < 3 ? ["Creator disclosure update", "Open-model field notes", "A better review checklist"][index] : `Scheduled dispatch ${index + 1}`,
    channel: channel.name,
    channelId: channel.id,
    agentId: channel.agentId,
    platform: channel.platform,
    scheduled: `${String(15 + Math.floor(index / 4)).padStart(2, "0")}:${String((index * 11) % 60).padStart(2, "0")}`,
    risk: 6 + ((index * 7) % 48),
    decision: index === 8 ? "HOLD" : "PENDING",
  };
});

export const demoIncident = {
  id: "INC-0042",
  title: "Cross-channel duplication outbreak",
  severity: "CRITICAL",
  source: "shorts-agent-03",
  affectedPosts: 8,
  affectedChannels: 5,
  action: "Agent halted automatically",
  status: "Contained",
  timeline: [
    ["14:32:11", "Similarity warning", "Second near-duplicate enters the gateway"],
    ["14:32:14", "Threshold violation", "Portfolio similarity reaches 0.81"],
    ["14:32:19", "Critical policy", "CROSS_CHANNEL_DUPLICATION fires"],
    ["14:32:20", "Agent HALTED", "shorts-agent-03 isolated"],
    ["14:32:21", "Queue frozen", "8 risky posts blocked; other agents continue"],
  ],
};

export const incidentDemoSteps = [
  { label: "Gateway", detail: "Publish requests enter Pevier", status: "INGESTED", risk: 8 },
  { label: "First post", detail: "Original request allowed", status: "ALLOW", risk: 12 },
  { label: "Similarity", detail: "Second channel matches at 0.74", status: "WARNING", risk: 44 },
  { label: "Pattern", detail: "Fourth channel matches at 0.91", status: "HIGH", risk: 76 },
  { label: "Policy engine", detail: "Portfolio threshold exceeded", status: "CRITICAL", risk: 92 },
  { label: "Circuit breaker", detail: "shorts-agent-03 isolated", status: "HALTED", risk: 92 },
  { label: "Containment", detail: "8 queued posts blocked", status: "BLOCK", risk: 92 },
  { label: "Audit", detail: "Evidence hash chained", status: "VERIFIED", risk: 92 },
];
