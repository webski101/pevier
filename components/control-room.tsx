"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Archive, ArrowRight, Ban, Bot, Check, ChevronRight, CircleStop, Command, Fingerprint, Gauge, Globe2, History, Instagram, LayoutDashboard, ListChecks, LoaderCircle, Menu, Moon, Network, RadioTower, Search, Settings, Shield, ShieldAlert, ShieldCheck, SlidersHorizontal, Sun, TerminalSquare, Unplug, Upload, X, Youtube, Zap } from "lucide-react";
import { demoAgents, demoChannels, demoIncident, incidentDemoSteps, queuedPosts } from "@/lib/demo-data";
import type { CircuitStatus } from "@/lib/types";

type View = "Overview" | "Publish Queue" | "Portfolio" | "Policies" | "Incidents" | "Audit Log" | "Settings";
type EventItem = { label: string; detail: string; status: string; risk: number };
type YouTubeStatus = { configured: boolean; connected: boolean; authenticated: boolean; status: string; mode: "DRY_RUN" | "LIVE"; accountLabel: string | null; channelId: string | null; channelHandle: string | null; agentId: string | null; tokenExpiresAt: string | null; privateOnly: true; observedUploads: number; uploadLimit: number; lastError: string | null };
type InstagramStatus = { configured: boolean; connected: boolean; status: string; mode: "DRY_RUN" | "LIVE"; requestedMode: "DRY_RUN" | "LIVE"; accountId: string | null; username: string | null; accountType: string | null; tokenStoredServerSide: true; publishingImplemented: true; publicOnly: true; safetyLock: string; lastError: string | null };
type AgentGatewayStatus = { ready: boolean; accessMode: "KEY_PROTECTED" | "LOCAL_ONLY" | "KEY_REQUIRED"; endpoint: string; credentialsIsolated: true; lastDecision: { id: string; timestamp: string; agentId: string | null; channelId: string | null; action: string; decision: string | null; riskScore: number | null } | null };
type AuditRecord = { id: string; timestamp: string; actor: string; agentId: string | null; channelId: string | null; channelName: string | null; platform: string | null; action: string; decision: string | null; riskScore: number | null; violationCount: number; previousHash: string; hash: string };
type AuditPayload = { records: AuditRecord[]; verification: { valid: boolean; checked?: number; index?: number }; simulatedTampering?: boolean };
const INSTAGRAM_PILOT_ENABLED = false;
const nav: { label: View; icon: typeof Activity }[] = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Publish Queue", icon: ListChecks }, { label: "Portfolio", icon: Network },
  { label: "Policies", icon: SlidersHorizontal }, { label: "Incidents", icon: ShieldAlert }, { label: "Audit Log", icon: Fingerprint }, { label: "Settings", icon: Settings },
];
const initialPolicies = [
  { id: "CROSS_CHANNEL_DUPLICATION", name: "Cross-channel similarity", severity: "CRITICAL", description: "Stops substantially similar content spreading across the portfolio.", warnAt: .65, holdAt: .75, blockAt: .88, enabled: true },
  { id: "REPETITIVE_TEMPLATE_PATTERN", name: "Repetitive template pattern", severity: "HIGH", description: "Compares recent titles, hooks, descriptions, and structure.", warnAt: .6, holdAt: .75, blockAt: .92, enabled: true },
  { id: "AI_SENSITIVE_PERSONA", name: "AI sensitive-persona guard", severity: "CRITICAL", description: "Blocks synthetic presenters on financial, health, and legal topics.", warnAt: .5, holdAt: .7, blockAt: .9, enabled: true },
  { id: "DISCLOSURE_REQUIRED", name: "Transparency and disclosure", severity: "HIGH", description: "Holds synthetic public-interest media without review or disclosure.", warnAt: .5, holdAt: .75, blockAt: .95, enabled: true },
  { id: "CADENCE_ANOMALY", name: "Upload cadence anomaly", severity: "HIGH", description: "Detects publishing velocity outside channel and agent baselines.", warnAt: .55, holdAt: .8, blockAt: .96, enabled: true },
];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) { return <span className={`badge badge--${tone}`}>{children}</span>; }

function RiskDial({ score }: { score: number }) {
  const c = 264;
  return <div className="risk-dial" aria-label={`Risk score ${score} of 100`}><svg viewBox="0 0 120 120"><circle className="risk-dial__track" cx="60" cy="60" r="42" /><circle className={`risk-dial__value risk-dial__value--${score >= 80 ? "danger" : score >= 60 ? "warn" : "safe"}`} cx="60" cy="60" r="42" strokeDasharray={c} strokeDashoffset={c - c * score / 100} /></svg><div><strong>{String(score).padStart(2, "0")}</strong><span>/ 100</span></div></div>;
}

export function ControlRoom() {
  const [view, setView] = useState<View>("Overview");
  const [dark, setDark] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [governor, setGovernor] = useState<CircuitStatus>("RUNNING");
  const [agentState, setAgentState] = useState<CircuitStatus>("RUNNING");
  const [risk, setRisk] = useState(18);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [demoRunning, setDemoRunning] = useState(false);
  const [contained, setContained] = useState(false);
  const [verification, setVerification] = useState<null | { valid: boolean; checked?: number; index?: number }>(null);
  const [tampered, setTampered] = useState(false);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<(typeof queuedPosts)[number] | null>(null);
  const [emergencyConfirm, setEmergencyConfirm] = useState(false);
  const [policies, setPolicies] = useState(initialPolicies);
  const [saved, setSaved] = useState<string | null>(null);
  const [youtubeStatus, setYoutubeStatus] = useState<YouTubeStatus | null>(null);
  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus | null>(null);
  const commandInput = useRef<HTMLInputElement>(null);

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "Settings") setView("Settings");
    fetch("/api/platforms/youtube", { cache: "no-store" }).then((response) => response.json()).then(setYoutubeStatus).catch(() => undefined);
    if (INSTAGRAM_PILOT_ENABLED) fetch("/api/platforms/instagram", { cache: "no-store" }).then((response) => response.json()).then(setInstagramStatus).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (view !== "Audit Log") return;
    const controller = new AbortController();
    setAuditLoading(true);
    setAuditError(null);
    fetch("/api/audit", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("The audit service could not load the evidence chain.");
        return response.json() as Promise<AuditPayload>;
      })
      .then((data) => setAuditRecords(data.records))
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") setAuditError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setAuditLoading(false); });
    return () => controller.abort();
  }, [view]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen((v) => !v); }
      if (event.key === "Escape") { setCommandOpen(false); setEmergencyConfirm(false); setSelectedPost(null); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (commandOpen) setTimeout(() => commandInput.current?.focus(), 0); }, [commandOpen]);

  const runIncident = async () => {
    if (demoRunning) return;
    setView("Overview"); setDemoRunning(true); setContained(false); setEvents([]); setRisk(8); setGovernor("RUNNING"); setAgentState("RUNNING");
    for (let i = 0; i < incidentDemoSteps.length; i++) { await wait(620); const step = incidentDemoSteps[i]; setEvents((v) => [...v, step]); setRisk(step.risk); if (i === 2) setGovernor("PAUSED"); if (i === 5) { setAgentState("HALTED"); setGovernor("RUNNING"); } }
    setContained(true); setDemoRunning(false);
  };
  const runSafe = async () => {
    if (demoRunning) return;
    setView("Overview"); setDemoRunning(true); setContained(false); setEvents([]); setRisk(4); setGovernor("RUNNING"); setAgentState("RUNNING");
    for (const step of [{ label: "Gateway", detail: "Original research brief received", status: "INGESTED", risk: 4 }, { label: "Policy engine", detail: "5 policy checks passed", status: "PASS", risk: 8 }, { label: "Mock adapter", detail: "Dry-run publication completed", status: "ALLOW", risk: 8 }]) { await wait(560); setEvents((v) => [...v, step]); setRisk(step.risk); }
    setDemoRunning(false);
  };
  const verify = async (tamper = false) => {
    setAuditLoading(true); setAuditError(null);
    try {
      const response = await fetch("/api/audit", tamper ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "tamper" }) } : { cache: "no-store" });
      if (!response.ok) throw new Error("The audit service could not verify the evidence chain.");
      const data = await response.json() as AuditPayload;
      setAuditRecords(data.records); setVerification(data.verification); setTampered(Boolean(data.simulatedTampering));
    } catch (error) { setAuditError(error instanceof Error ? error.message : "The audit evidence could not be verified."); }
    finally { setAuditLoading(false); }
  };
  const choose = (next: View) => { setView(next); setMobileNav(false); setCommandOpen(false); };

  return <div className="app-shell">
    <aside className={`side-rail ${mobileNav ? "is-open" : ""}`}><div className="brand"><div className="brand__mark"><Shield size={17} /></div><div><strong>PEVIER</strong><span>POLICY FIREWALL</span></div></div><nav>{nav.map((item) => <button key={item.label} className={`nav-item ${view === item.label ? "is-active" : ""}`} onClick={() => choose(item.label)}><item.icon size={17} /><span>{item.label}</span>{item.label === "Incidents" && <i>1</i>}</button>)}</nav><div className="rail-foot"><div className="connection"><span className="live-dot" />Gateway online</div><button className="command-button" onClick={() => setCommandOpen(true)}><Command size={14} /><span>Command</span><kbd>⌘K</kbd></button><div className="workspace"><div className="avatar">AO</div><span>Atlas Ops<small>Demo workspace</small></span><ChevronRight size={15} /></div></div></aside>
    <div className="app-main"><header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav((v) => !v)} aria-label="Open navigation">{mobileNav ? <X /> : <Menu />}</button><div><span>ATLAS MEDIA /</span><strong>{view}</strong></div><div className="topbar__actions"><Badge tone={youtubeStatus?.connected && youtubeStatus.mode === "LIVE" ? "warn" : "safe"}><span className="live-dot" /> {youtubeStatus?.connected && youtubeStatus.mode === "LIVE" ? "YOUTUBE PRIVATE" : "DRY RUN"}</Badge><button className="icon-button" onClick={() => setDark((v) => !v)} aria-label="Change theme">{dark ? <Sun size={17} /> : <Moon size={17} />}</button><button className="emergency-small" onClick={() => setEmergencyConfirm(true)}><CircleStop size={15} />Emergency stop</button></div></header><main>
      {view === "Overview" && <Overview governor={governor} agentState={agentState} risk={risk} events={events} demoRunning={demoRunning} contained={contained} publisherMode={youtubeStatus?.connected && youtubeStatus.mode === "LIVE" ? "YouTube private" : "Dry run"} onIncident={runIncident} onSafe={runSafe} onAudit={() => choose("Audit Log")} onEmergency={() => setEmergencyConfirm(true)} />}
      {view === "Publish Queue" && <PublishQueue onSelect={setSelectedPost} />}
      {view === "Portfolio" && <Portfolio agentState={agentState} />}
      {view === "Policies" && <Policies items={policies} setItems={setPolicies} saved={saved} setSaved={setSaved} />}
      {view === "Incidents" && <Incidents contained={contained} onRun={runIncident} />}
      {view === "Audit Log" && <AuditLog records={auditRecords} loading={auditLoading} error={auditError} verification={verification} tampered={tampered} onVerify={() => verify(false)} onTamper={() => verify(true)} onRetry={() => verify(false)} />}
      {view === "Settings" && <SettingsView activePolicies={policies.filter((p) => p.enabled).length} youtube={youtubeStatus} instagram={instagramStatus} onYouTubeChange={setYoutubeStatus} />}
    </main><footer className="foot-line"><span>PEVIER / POLICY CONTROL PLANE</span><span>Policy set v1.4 · SHA-256 evidence · {youtubeStatus?.connected && youtubeStatus.mode === "LIVE" ? "YOUTUBE PRIVATE" : "DRY RUN"}</span><span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span></footer></div>
    {commandOpen && <div className="modal-backdrop" onMouseDown={() => setCommandOpen(false)}><section className="command-palette" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><div className="command-search"><Search size={18} /><input ref={commandInput} placeholder="Go to a control surface…" /></div>{nav.map((item) => <button key={item.label} onClick={() => choose(item.label)}><item.icon size={17} /><span>Open {item.label}</span><ArrowRight size={15} /></button>)}</section></div>}
    {emergencyConfirm && <div className="modal-backdrop" onMouseDown={() => setEmergencyConfirm(false)}><section className="confirm-dialog" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><div className="danger-icon"><CircleStop /></div><h2>Kill portfolio publishing?</h2><p>This demo stops every Pevier circuit. No social account is connected and no external publication will be changed.</p><div><button className="button button--quiet" onClick={() => setEmergencyConfirm(false)}>Cancel</button><button className="button button--danger" onClick={() => { setGovernor("KILLED"); setAgentState("KILLED"); setEmergencyConfirm(false); }}>Kill demo circuits</button></div></section></div>}
    {selectedPost && <DecisionDrawer post={selectedPost} onClose={() => setSelectedPost(null)} />}
  </div>;
}

function Overview({ governor, agentState, risk, events, demoRunning, contained, publisherMode, onIncident, onSafe, onAudit, onEmergency }: { governor: CircuitStatus; agentState: CircuitStatus; risk: number; events: EventItem[]; demoRunning: boolean; contained: boolean; publisherMode: string; onIncident: () => void; onSafe: () => void; onAudit: () => void; onEmergency: () => void }) {
  const tone = governor === "RUNNING" ? "safe" : governor === "PAUSED" ? "warn" : "danger";
  return <div className="page control-room reveal"><section className="page-intro"><div><p className="context-line"><RadioTower size={14} /> LIVE CONTROL ROOM</p><h1>Control Room</h1></div><p className="page-intro__lede">Policy enforcement is live across 12 channels. Every autonomous request is inspected before an adapter can publish.</p><div className="intro-actions"><button className="button button--quiet" onClick={onSafe} disabled={demoRunning}><ShieldCheck size={17} />Run safe demo</button><button className="button button--primary" onClick={onIncident} disabled={demoRunning}><Zap size={17} />{demoRunning ? "Incident running" : "Run incident demo"}</button></div></section>
    <section className="metric-strip">{[["12", "Channels"], ["4", "Platforms"], ["4", "Active agents"], ["37", "Pending posts"]].map(([v, l]) => <div key={l}><strong>{v}</strong><span>{l}</span></div>)}<div className="quota"><span>Platform quota</span><strong>72 / 100</strong><i><b /></i><small>28 remaining · Safe</small></div></section>
    <section className="gateway-route" aria-label="Publishing enforcement path"><div><Bot size={17} /><span>Autonomous agents<small>4 active</small></span></div><ArrowRight /><div className="gateway-route__active"><Shield size={18} /><span>Pevier gateway<small>Inspecting</small></span></div><ArrowRight /><div><SlidersHorizontal size={17} /><span>Policy engine<small>5 active rules</small></span></div><ArrowRight /><div><Globe2 size={17} /><span>Platform adapters<small>{publisherMode}</small></span></div></section>
    <div className="control-grid"><section className={`governor-panel governor-panel--${tone}`}><div className="panel-head"><div><span>PORTFOLIO GOVERNOR</span><small>Updated now</small></div><Badge tone={tone}><span className="state-dot" /> {governor}</Badge></div><div className="governor-main"><div><p>Current state</p><h2><span className="state-dot state-dot--large" />{governor}</h2><span>{governor === "RUNNING" ? "Normal publishing. Every request is policy-gated." : governor === "PAUSED" ? "Risky requests are waiting for review." : "Publishing circuits are stopped."}</span></div><RiskDial score={risk} /></div><div className="state-path">{["RUNNING", "PAUSED", "HALTED", "KILLED"].map((state, index) => <span key={state} className={governor === state ? "is-active" : ""}>{index > 0 && <i />}{state}</span>)}</div><button className="emergency-button" onClick={onEmergency}><CircleStop size={20} /><strong>Emergency stop</strong><ArrowRight /></button></section>
      <section className="event-panel"><div className="panel-head"><div><span>DECISION STREAM</span><small>{events.length ? `${events.length} events in this run` : "Awaiting gateway activity"}</small></div><Activity size={18} /></div><div className="event-stream" aria-live="polite">{!events.length && <div className="empty-state"><RadioTower /><strong>No live decisions</strong><span>Run a scenario to watch the gateway evaluate a publication.</span></div>}{events.map((event, i) => <div className="event-row" key={`${event.label}-${i}`}><i className={`event-node event-node--${event.status.toLowerCase()}`} /><div><strong>{event.label}</strong><span>{event.detail}</span></div><Badge tone={["ALLOW", "PASS", "VERIFIED"].includes(event.status) ? "safe" : ["CRITICAL", "HALTED", "BLOCK"].includes(event.status) ? "danger" : "warn"}>{event.status}</Badge><time>+{String(i * 3 + 1).padStart(2, "0")}s</time></div>)}</div></section></div>
    <section className={`containment ${contained ? "is-contained" : ""}`}><div className="containment__head"><div><span className="context-line"><ShieldAlert size={14} /> BLAST RADIUS</span><h2>{contained ? "Threat contained." : "Contain the source, not the portfolio."}</h2><p>{contained ? "The responsible agent is halted. Seven unaffected channels remain operational." : "Pevier isolates risky agents and their channels before escalating to a portfolio-wide stop."}</p></div>{contained && <Badge tone="safe"><ShieldCheck size={14} /> EVIDENCE SEALED</Badge>}</div><div className="blast-grid"><div className="agent-node"><Bot /><span>shorts-agent-03<small>Autonomous publisher</small></span><Badge tone={agentState === "HALTED" ? "danger" : "safe"}>{agentState}</Badge></div><div className="channel-map">{demoChannels.map((channel, i) => <div key={channel.id} className={i < 5 && agentState === "HALTED" ? "is-affected" : ""}><span>{i < 5 ? <Ban /> : <Check />}</span><small>{channel.name}</small></div>)}</div><div className="containment-stats"><div><strong>{contained ? "8" : "0"}</strong><span>unsafe publications prevented</span></div><div><strong>{contained ? "5" : "0"}</strong><span>channels protected</span></div><div><strong>7</strong><span>channels remained operational</span></div></div>{contained && <button className="button button--quiet" onClick={onAudit}>Open audit evidence <ArrowRight size={16} /></button>}</div></section>
  </div>;
}

function PublishQueue({ onSelect }: { onSelect: (post: (typeof queuedPosts)[number]) => void }) {
  return <div className="page reveal"><PageTitle icon={ListChecks} title="Publish queue" copy="Every request waits here until the gateway returns ALLOW, HOLD, or BLOCK." action={<Badge>15 SCHEDULED</Badge>} /><div className="filter-row"><button className="filter is-active">All requests <b>15</b></button><button className="filter">Pending <b>14</b></button><button className="filter">Held <b>1</b></button><div /><button className="button button--quiet"><Search size={15} />Search queue</button></div><section className="data-surface"><div className="data-row data-row--head"><span>Post / channel</span><span>Agent</span><span>Platform</span><span>Scheduled</span><span>Risk</span><span>Decision</span><span /></div>{queuedPosts.map((post) => <button className="data-row" key={post.id} onClick={() => onSelect(post)}><span><strong>{post.title}</strong><small>{post.id} · {post.channel}</small></span><span data-label="Agent">{post.agentId}</span><span data-label="Platform">{post.platform}</span><span data-label="Scheduled">Today {post.scheduled}</span><span data-label="Risk"><i className={`risk-bar risk-bar--${post.risk > 40 ? "warn" : "safe"}`} style={{ "--risk": `${post.risk}%` } as React.CSSProperties} />{post.risk}</span><span data-label="Decision"><Badge tone={post.decision === "HOLD" ? "warn" : "neutral"}>{post.decision}</Badge></span><ChevronRight size={16} /></button>)}</section></div>;
}

function Portfolio({ agentState }: { agentState: CircuitStatus }) {
  return <div className="page reveal"><PageTitle icon={Globe2} title="Portfolio" copy="Twelve channels share one policy perimeter without sharing one failure domain." action={<button className="button button--quiet"><Archive size={16} />Export inventory</button>} /><section className="portfolio-layout"><div className="data-surface channel-table"><div className="data-row data-row--head"><span>Channel</span><span>Platform</span><span>Risk</span><span>State</span><span>Agent</span></div>{demoChannels.map((channel, i) => { const state = i < 5 ? agentState : "RUNNING"; return <div className="data-row" key={channel.id}><span><strong>{channel.name}</strong><small>{channel.handle}</small></span><span data-label="Platform">{channel.platform}</span><span data-label="Risk"><b className={`risk-number risk-number--${channel.risk > 40 ? "warn" : "safe"}`}>{channel.risk}</b></span><span data-label="State"><Badge tone={state === "RUNNING" ? "safe" : "danger"}>{state}</Badge></span><span data-label="Agent">{channel.agentId}</span></div>; })}</div><aside className="agents-panel"><div className="panel-head"><div><span>AUTONOMOUS PUBLISHERS</span><small>Independent circuit state</small></div><Bot size={17} /></div>{demoAgents.map((agent) => { const state = agent.id === "shorts-agent-03" ? agentState : agent.state; return <div className="agent-row" key={agent.id}><div className="agent-symbol"><Bot size={17} /></div><span><strong>{agent.name}</strong><small>{agent.postsToday} today · {agent.blocks} blocked</small></span><div><Badge tone={state === "RUNNING" ? "safe" : "danger"}>{state}</Badge><small>Risk {agent.id === "shorts-agent-03" && state === "HALTED" ? 92 : agent.risk}</small></div></div>; })}</aside></section></div>;
}

function Policies({ items, setItems, saved, setSaved }: { items: typeof initialPolicies; setItems: React.Dispatch<React.SetStateAction<typeof initialPolicies>>; saved: string | null; setSaved: (v: string | null) => void }) {
  const update = (id: string, key: "enabled" | "blockAt", value: boolean | number) => { setItems((all) => all.map((item) => item.id === id ? { ...item, [key]: value } : item)); setSaved(id); fetch("/api/policies", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, [key]: value }) }).catch(() => undefined); setTimeout(() => setSaved(null), 1200); };
  return <div className="page reveal"><PageTitle icon={SlidersHorizontal} title="Policy engine" copy="Thresholds are runtime configuration. Changes affect the next gateway request." action={<Badge tone="safe">{items.filter((p) => p.enabled).length} ACTIVE</Badge>} /><div className="policy-list">{items.map((policy) => <section className="policy-row" key={policy.id}><div className="policy-copy"><div><h2>{policy.name}</h2><Badge tone={policy.severity === "CRITICAL" ? "danger" : "warn"}>{policy.severity}</Badge></div><p>{policy.description}</p><code>{policy.id}</code></div><label className="switch"><input type="checkbox" checked={policy.enabled} onChange={(e) => update(policy.id, "enabled", e.target.checked)} /><span /><b>{policy.enabled ? "ON" : "OFF"}</b></label><div className="thresholds"><span>Warn at <strong>{Math.round(policy.warnAt * 100)}%</strong></span><span>Hold at <strong>{Math.round(policy.holdAt * 100)}%</strong></span><label>Block at <strong>{Math.round(policy.blockAt * 100)}%</strong><input aria-label={`${policy.name} block threshold`} type="range" min="50" max="100" value={Math.round(policy.blockAt * 100)} onChange={(e) => update(policy.id, "blockAt", Number(e.target.value) / 100)} /></label></div><div className="save-state">{saved === policy.id ? <><Check size={14} />Saved</> : "Runtime policy"}</div></section>)}</div><p className="legal-note"><Shield size={16} />Pevier provides automated policy enforcement assistance and risk signals. Final legal and platform-policy responsibility remains with the operator.</p></div>;
}

function Incidents({ contained, onRun }: { contained: boolean; onRun: () => void }) {
  return <div className="page reveal"><PageTitle icon={ShieldAlert} title="Incident center" copy="Containment events join policy evidence, circuit transitions, and affected resources." action={<button className="button button--primary" onClick={onRun}><Zap size={16} />Run incident demo</button>} /><section className="incident-hero"><div><div className="incident-id">{demoIncident.id}<Badge tone="danger">{demoIncident.severity}</Badge></div><h2>{demoIncident.title}</h2><p>Source <strong>{demoIncident.source}</strong> crossed the duplication threshold. Pevier halted one agent and left unrelated publishers running.</p><div className="incident-meta"><span><small>Action</small>{demoIncident.action}</span><span><small>Status</small>{contained ? "Contained now" : demoIncident.status}</span><span><small>Affected</small>{demoIncident.affectedPosts} posts / {demoIncident.affectedChannels} channels</span></div></div><ShieldAlert className="incident-watermark" /></section><section className="timeline"><div className="panel-head"><div><span>CONTAINMENT TIMELINE</span><small>Machine timestamps · local demo</small></div><History size={17} /></div>{demoIncident.timeline.map(([time, title, copy], i) => <div className="timeline-row" key={time}><time>{time}</time><i className={i >= 3 ? "is-danger" : ""} /><div><strong>{title}</strong><span>{copy}</span></div>{i === 4 && <Badge tone="safe">SEALED</Badge>}</div>)}</section></div>;
}

function shortHash(value: string) {
  return value === "GENESIS" ? value : `${value.slice(0, 7)}…${value.slice(-4)}`;
}

function AuditLog({ records, loading, error, verification, tampered, onVerify, onTamper, onRetry }: {
  records: AuditRecord[];
  loading: boolean;
  error: string | null;
  verification: null | { valid: boolean; checked?: number; index?: number };
  tampered: boolean;
  onVerify: () => void;
  onTamper: () => void;
  onRetry: () => void;
}) {
  return <div className="page reveal">
    <PageTitle icon={Fingerprint} title="Audit evidence" copy="Live policy decisions and state transitions, linked record by record with SHA-256." action={<div className="button-pair"><button className="button button--quiet dev-action" onClick={onTamper} disabled={loading || !records.length}>Simulate tampering</button><button className="button button--primary" onClick={onVerify} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}{loading ? "Checking chain…" : "Verify chain"}</button></div>} />
    {verification && <section className={`verification ${verification.valid ? "is-valid" : "is-invalid"}`} role="status"><div>{verification.valid ? <ShieldCheck /> : <ShieldAlert />}<span><strong>{verification.valid ? "Chain integrity verified" : tampered ? "Tampering simulation detected" : "Chain invalid"}</strong><small>{verification.valid ? `${verification.checked ?? records.length} records checked · hashes and links valid` : `Change detected at chronological record #${(verification.index ?? 0) + 1}${tampered ? " · stored evidence was not modified" : ""}`}</small></span></div><div>{verification.valid ? <><span><Check />Hashes valid</span><span><Check />Links valid</span><span><Check />No modified records</span></> : <><span><X />Record content changed</span><span><X />Downstream link compromised</span></>}</div></section>}
    {error && <section className="audit-state audit-state--error" role="alert"><AlertTriangle /><div><strong>Audit evidence unavailable</strong><span>{error}</span></div><button className="button button--quiet" onClick={onRetry}>Try again</button></section>}
    {!error && loading && !records.length && <section className="audit-state" aria-live="polite"><LoaderCircle className="spin" /><div><strong>Loading live evidence</strong><span>Reading the local audit chain and resolving channel identities.</span></div></section>}
    {!error && !loading && !records.length && <section className="audit-state"><Fingerprint /><div><strong>No audit evidence yet</strong><span>Evaluate a publication to create the first cryptographically linked record.</span></div></section>}
    {!!records.length && <section className="audit-chain" aria-label={`${records.length} live audit records`}><div className="audit-head"><span>Record / channel</span><span>Timestamp</span><span>Decision / action</span><span>Previous hash</span><span>SHA-256</span></div>{records.map((record) => {
      const changed = record.action.endsWith("_MODIFIED");
      const tone = record.decision === "ALLOW" ? "safe" : record.decision === "HOLD" ? "warn" : record.decision === "BLOCK" ? "danger" : "neutral";
      return <div className={`audit-row ${changed ? "is-tampered" : ""}`} key={record.id}>
        <span className="audit-record"><Fingerprint size={14} /><span><strong>AUD-{record.id.slice(0, 8).toUpperCase()}</strong><small title={record.channelId ?? undefined}>{record.channelName ?? "Portfolio control plane"}</small></span></span>
        <time dateTime={record.timestamp}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(record.timestamp))}</time>
        <span className="audit-action"><span><Badge tone={tone}>{record.decision ?? "STATE"}</Badge><strong>{record.action}</strong></span><small>{record.actor}{record.platform ? ` · ${record.platform}` : ""}{record.riskScore !== null ? ` · risk ${record.riskScore}` : ""}{record.violationCount ? ` · ${record.violationCount} violation${record.violationCount === 1 ? "" : "s"}` : ""}</small></span>
        <code title={record.previousHash}>{shortHash(record.previousHash)}</code>
        <code title={record.hash}>{shortHash(record.hash)}</code>
      </div>;
    })}</section>}
  </div>;
}

function SettingsView({ activePolicies, youtube, instagram, onYouTubeChange }: { activePolicies: number; youtube: YouTubeStatus | null; instagram: InstagramStatus | null; onYouTubeChange: (status: YouTubeStatus) => void }) {
  const [busy, setBusy] = useState<"mode" | "disconnect" | "upload" | "instagram" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ tone: string; title: string; detail: string } | null>(null);
  const [instagramResult, setInstagramResult] = useState<{ tone: string; title: string; detail: string; evidence?: string } | null>(null);
  const [agentGateway, setAgentGateway] = useState<AgentGatewayStatus | null>(null);
  const [agentStatusError, setAgentStatusError] = useState(false);
  const snippet = ['const response = await fetch("/api/publish", {', '  method: "POST",', '  headers: {', '    "content-type": "application/json",', '    authorization: `Bearer ${PEVIER_AGENT_KEY}`', '  },', '  body: JSON.stringify(post)', '});', '', 'const result = await response.json();'].join("\n");

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("youtube");
    const messages: Record<string, string> = {
      connected: "YouTube connected. Pevier remains in dry-run mode.",
      denied: "YouTube authorization was cancelled.",
      "missing-config": "Add the Google OAuth values to .env before connecting.",
      "invalid-state": "The OAuth state check failed. Please try connecting again.",
      "connection-failed": "YouTube could not be connected. Check the OAuth configuration and redirect URI.",
    };
    if (result && messages[result]) setNotice(messages[result]);
    fetch("/api/status", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => setAgentGateway(data.agentGateway))
      .catch(() => setAgentStatusError(true));
  }, []);

  const updateMode = async (mode: "DRY_RUN" | "LIVE") => {
    setBusy("mode"); setNotice(null);
    const response = await fetch("/api/platforms/youtube", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
    const data = await response.json();
    if (response.ok) { onYouTubeChange(data); setNotice(mode === "LIVE" ? "Live adapter enabled. Every upload is still forced to private." : "YouTube returned to dry-run mode."); }
    else setNotice(data.error ?? "Could not change the YouTube mode.");
    setBusy(null);
  };

  const disconnect = async () => {
    setBusy("disconnect");
    const response = await fetch("/api/platforms/youtube", { method: "DELETE" });
    const data = await response.json();
    onYouTubeChange(data); setNotice("YouTube disconnected and stored OAuth tokens were removed."); setBusy(null);
  };

  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy("upload"); setUploadResult(null);
    if (!youtube?.channelId || !youtube.agentId) {
      setUploadResult({ tone: "warn", title: "Channel identity required", detail: "Reconnect YouTube once so Pevier can bind policy evidence to the real channel." });
      setBusy(null); return;
    }
    const form = new FormData(event.currentTarget);
    form.set("channelId", youtube.channelId);
    form.set("agentId", youtube.agentId);
    form.set("humanEditorialReview", form.get("humanEditorialReview") ? "true" : "false");
    form.set("platformDisclosureEnabled", form.get("platformDisclosureEnabled") ? "true" : "false");
    try {
      const response = await fetch("/api/platforms/youtube/upload", { method: "POST", body: form });
      const data = await response.json();
      if (data.publication?.published) setUploadResult({ tone: "safe", title: "Private upload completed", detail: `YouTube video ${data.publication.externalId} passed policy and was uploaded privately.` });
      else if (data.decision === "HOLD" || data.decision === "BLOCK") setUploadResult({ tone: data.decision === "BLOCK" ? "danger" : "warn", title: `${data.decision}: nothing uploaded`, detail: `Pevier returned risk ${data.riskScore}/100 and stopped before the YouTube adapter.` });
      else setUploadResult({ tone: response.ok ? "neutral" : "danger", title: response.ok ? "Dry-run completed" : "Upload failed safely", detail: data.publication?.reason ?? data.error ?? "YouTube did not receive the video." });
    } catch { setUploadResult({ tone: "danger", title: "Upload failed safely", detail: "The request could not reach Pevier. Nothing was sent to YouTube." }); }
    setBusy(null);
  };
  const simulateInstagram = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy("instagram"); setInstagramResult(null);
    const form = new FormData(event.currentTarget);
    form.set("syntheticMedia", form.get("syntheticMedia") ? "true" : "false");
    form.set("humanEditorialReview", form.get("humanEditorialReview") ? "true" : "false");
    form.set("platformDisclosureEnabled", form.get("platformDisclosureEnabled") ? "true" : "false");
    form.set("confirmPublicPublish", form.get("confirmPublicPublish") ? "true" : "false");
    if (instagram?.mode === "LIVE") form.set("format", "REEL");
    try {
      const response = await fetch("/api/platforms/instagram/publish", { method: "POST", body: form });
      const data = await response.json();
      if (data.publication?.published) setInstagramResult({ tone: "safe", title: "Public Reel published", detail: `Instagram media ${data.publication.externalId} passed policy and was published publicly to ${data.simulation?.destination ?? "Instagram"}.`, evidence: data.decisionId });
      else if (data.decision === "ALLOW") setInstagramResult({ tone: response.ok ? "safe" : "danger", title: response.ok ? "Dry run passed" : "Instagram publish failed safely", detail: response.ok ? `${data.simulation?.destination ?? "Instagram"} received no post. Pevier simulated the complete handoff and stopped before Meta.` : data.publication?.reason ?? data.error ?? "Instagram did not confirm a published Reel.", evidence: data.decisionId });
      else if (data.decision === "HOLD" || data.decision === "BLOCK") setInstagramResult({ tone: data.decision === "BLOCK" ? "danger" : "warn", title: `${data.decision}: simulation stopped`, detail: `Risk ${data.riskScore}/100. The policy firewall stopped before the Instagram adapter.`, evidence: data.decisionId });
      else setInstagramResult({ tone: "danger", title: "Simulation failed safely", detail: data.error ?? "No request was sent to Instagram." });
    } catch { setInstagramResult({ tone: "danger", title: "Simulation failed safely", detail: "The request could not reach Pevier. Nothing was sent to Instagram." }); }
    setBusy(null);
  };
  const uploadLock = !youtube?.connected ? "Connect YouTube before attempting an upload." : !youtube.channelId ? "Reconnect once to load and bind your real YouTube channel identity." : youtube.mode !== "LIVE" ? "Enable Live private to permit a real upload." : null;
  const instagramLive = instagram?.connected && instagram.mode === "LIVE";
  return <div className="page reveal">
    <PageTitle icon={Settings} title="Gateway settings" copy="Connect a publisher without giving autonomous agents direct platform credentials." action={<Badge tone="safe"><span className="live-dot" /> API ONLINE</Badge>} />
    {notice && <div className="integration-notice" role="status"><Shield size={16} /><span>{notice}</span></div>}
    <section className="youtube-connection">
      <div className="youtube-connection__identity"><div className="youtube-mark"><Youtube /></div><div><span>LIVE ADAPTER</span><h2>YouTube</h2><p>Policy-gated uploads with a hard private-only boundary.</p></div></div>
      <div className="youtube-connection__status">
        <Badge tone={youtube?.connected ? "safe" : "neutral"}><span className={youtube?.connected ? "live-dot" : "offline-dot"} /> {youtube?.connected ? "CONNECTED" : "DISCONNECTED"}</Badge>
        <strong>{youtube?.configured ? youtube?.accountLabel ?? "Ready to authorize" : "OAuth configuration required"}</strong>
        <small>{youtube?.connected ? youtube.channelId ? `${youtube.channelHandle ?? youtube.channelId} · ${youtube.observedUploads} of ${youtube.uploadLimit} Pevier-observed uploads today` : "Connected securely · channel identity permission required" : "No social credential is available to agents or the browser."}</small>
      </div>
      <div className="youtube-connection__actions">
        {!youtube?.configured && <div className="config-callout"><code>GOOGLE_CLIENT_ID</code><code>GOOGLE_CLIENT_SECRET</code><code>PEVIER_ENCRYPTION_KEY</code></div>}
        {youtube?.configured && !youtube.connected && <a className="button button--primary" href="/api/platforms/youtube/connect"><Youtube size={17} />{youtube.authenticated ? "Connect YouTube" : "Sign in with Google"}</a>}
        {youtube?.connected && <>{!youtube.channelId && <a className="button button--primary" href="/api/platforms/youtube/connect"><Youtube size={17} />Identify channel</a>}<div className="mode-switch" aria-label="YouTube publisher mode"><button className={youtube.mode === "DRY_RUN" ? "is-active" : ""} disabled={busy !== null} onClick={() => updateMode("DRY_RUN")}>Dry run</button><button className={youtube.mode === "LIVE" ? "is-active" : ""} disabled={busy !== null || !youtube.channelId} onClick={() => updateMode("LIVE")}>Live private</button></div><button className="button button--quiet" disabled={busy !== null} onClick={disconnect}>{busy === "disconnect" ? <LoaderCircle className="spin" size={16} /> : <Unplug size={16} />}Disconnect</button></>}
      </div>
    </section>
    {INSTAGRAM_PILOT_ENABLED && <section className="instagram-connection">
      <div className="platform-connection__identity"><div className="instagram-mark"><Instagram /></div><div><span>{instagramLive ? "LIVE PUBLIC ADAPTER" : "PUBLISH ADAPTER"}</span><h2>Instagram</h2><p>Policy-gated Reel publishing for a verified Professional account.</p></div></div>
      <div className="platform-connection__status">
        <Badge tone={instagram?.connected ? "safe" : instagram?.status === "ERROR" ? "danger" : "neutral"}><span className={instagram?.connected ? "live-dot" : "offline-dot"} /> {instagram?.connected ? "VERIFIED" : instagram?.status === "ERROR" ? "TOKEN ERROR" : "NOT CONNECTED"}</Badge>
        <strong>{instagram?.connected ? `@${instagram.username ?? "professional-account"}` : instagram?.configured ? "Checking professional account" : "Server configuration required"}</strong>
        <small>{instagram?.connected ? `${instagram.accountType ?? "PROFESSIONAL"} · account ${instagram.accountId}` : instagram?.lastError ?? "Add the app ID and tester token to .env, then restart Pevier."}</small>
      </div>
      <div className="platform-connection__actions">
        {!instagram?.configured && <div className="config-callout"><code>INSTAGRAM_APP_ID</code><code>INSTAGRAM_ACCESS_TOKEN</code></div>}
        <Badge tone={instagramLive ? "danger" : "warn"}><ShieldCheck size={14} /> {instagramLive ? "LIVE · PUBLIC" : "DRY RUN"}</Badge>
        <small>{instagramLive ? "Live Reel publishing is armed. Every post still requires an explicit public-publish confirmation." : <>Set <code>INSTAGRAM_PUBLISH_MODE=&quot;LIVE&quot;</code> and restart Pevier only when you are ready to publish publicly.</>}</small>
      </div>
    </section>}
    {INSTAGRAM_PILOT_ENABLED && <section className="instagram-simulator">
      <div className="instagram-simulator__intro"><span>{instagramLive ? "LIVE REEL PUBLISHER" : "PUBLICATION DRY RUN"}</span><h2>{instagramLive ? "Publish one Reel through the firewall." : "Test an Instagram post without posting it."}</h2><p>{instagramLive ? "Pevier evaluates the caption and video before sending it to Meta. HOLD or BLOCK publishes nothing." : "Pevier inspects the caption and media, records an audit decision, and simulates the adapter handoff. Meta receives no media or caption."}</p><div className={`safe-lock ${instagramLive ? "safe-lock--public" : ""}`}><ShieldCheck size={16} />{instagramLive ? "Public confirmation required on every Reel" : "Dry run · nothing reaches Meta"}</div></div>
      <form className="instagram-form" onSubmit={simulateInstagram}>
        <label className="instagram-field"><span>Caption</span><textarea name="caption" required minLength={3} maxLength={2200} rows={5} placeholder="Write the caption Pevier should evaluate." /></label>
        <div className="instagram-media-fields">
          <label className="instagram-field"><span>Post format</span><select name="format" defaultValue={instagramLive ? "REEL" : "FEED"} disabled={instagramLive} key={instagramLive ? "live" : "dry"}><option value="FEED">Feed post</option><option value="REEL">Reel</option></select></label>
          {instagramLive
            ? <label className="instagram-field instagram-file-field"><span>Public video URL</span><input name="videoUrl" type="url" inputMode="url" placeholder="https://cdn.example.com/reel.mp4" required /><small>Direct HTTPS link to an MP4 or MOV file · Meta must be able to download it publicly</small></label>
            : <label className="instagram-field instagram-file-field"><span>Media file</span><input name="media" type="file" accept="image/*,video/*" required /><small>Image or video · maximum 128 MB · remains inside Pevier</small></label>}
        </div>
        <fieldset className="instagram-review-options"><legend>Review signals</legend><label><input type="checkbox" name="syntheticMedia" /><span>Contains synthetic media</span></label><label><input type="checkbox" name="humanEditorialReview" defaultChecked /><span>Human editorial review complete</span></label><label><input type="checkbox" name="platformDisclosureEnabled" defaultChecked /><span>Instagram disclosure configured</span></label>{instagramLive && <label className="instagram-public-confirmation"><input type="checkbox" name="confirmPublicPublish" required /><span>I approve publishing this Reel publicly</span></label>}</fieldset>
        <button className="button button--primary instagram-submit" type="submit" disabled={!instagram?.connected || busy !== null}>{busy === "instagram" ? <LoaderCircle className="spin" size={17} /> : instagramLive ? <Upload size={17} /> : <ShieldCheck size={17} />}{busy === "instagram" ? instagramLive ? "Publishing public Reel…" : "Evaluating dry run…" : instagram?.connected ? instagramLive ? "Evaluate and publish public Reel" : "Evaluate Instagram dry run" : "Verify Instagram first"}</button>
        {instagramResult && <div className={`upload-result upload-result--${instagramResult.tone}`} role="status"><strong>{instagramResult.title}</strong><span>{instagramResult.detail}</span>{instagramResult.evidence && <small>Evidence {instagramResult.evidence}</small>}</div>}
      </form>
    </section>}
    <section className="agent-bridge">
      <div className="agent-bridge__intro"><div className="agent-symbol"><Bot size={19} /></div><div><span>FREE LOCAL AGENT</span><h2>Publisher bridge</h2><p>A separate process can submit publication requests to Pevier without seeing or handling the connected Google credentials.</p></div></div>
      <div className="agent-route" aria-label="Autonomous agent enforcement path"><span><Bot size={16} /><strong>Local agent</strong><small>Untrusted requester</small></span><ArrowRight /><span><Shield size={16} /><strong>POST /api/publish</strong><small>{agentGateway?.accessMode === "KEY_PROTECTED" ? "Bearer-key protected" : "Localhost only"}</small></span><ArrowRight /><span><SlidersHorizontal size={16} /><strong>Policy firewall</strong><small>ALLOW · HOLD · BLOCK</small></span></div>
      <div className="agent-bridge__status">
        <Badge tone={agentStatusError ? "danger" : agentGateway?.ready ? "safe" : "warn"}><span className={agentGateway?.ready ? "live-dot" : "offline-dot"} /> {agentStatusError ? "UNAVAILABLE" : agentGateway?.ready ? "READY" : "CHECKING"}</Badge>
        <span><small>Access</small><strong>{agentGateway?.accessMode === "KEY_PROTECTED" ? "Shared key" : agentGateway?.accessMode === "KEY_REQUIRED" ? "Key required" : "Local only"}</strong></span>
        <span><small>OAuth boundary</small><strong>{agentGateway?.credentialsIsolated ? "Isolated" : "Checking"}</strong></span>
        <span><small>Last decision</small><strong>{agentGateway?.lastDecision?.decision ? `${agentGateway.lastDecision.decision} · risk ${agentGateway.lastDecision.riskScore ?? 0}` : "Awaiting agent"}</strong></span>
      </div>
      <div className="agent-commands"><span>Run in a second terminal while Pevier is open:</span><code>npm run agent:demo -- safe</code><code>npm run agent:demo -- repair</code><code>npm run agent:demo -- blocked</code><code>{'npm run agent:demo -- private "C:\\Videos\\clip.mp4" "Video title"'}</code><small>Repair tests one instructed retry with metadata only. HOLD or BLOCK never reaches YouTube.</small></div>
    </section>
    <div className="settings-grid"><section className="settings-panel"><div className="panel-head"><div><span>RUNTIME</span><small>YouTube local pilot</small></div><Gauge size={17} /></div>{[["YouTube mode", youtube?.connected ? youtube.mode : "DRY_RUN"], ["YouTube visibility", "PRIVATE ONLY"], ["Policy set", `${activePolicies} active`], ["Database", "SQLite / Prisma"], ["Audit digest", "SHA-256"], ["YouTube uploads", `${youtube?.observedUploads ?? 0} / ${youtube?.uploadLimit ?? 100}`]].map(([label, value]) => <div className="setting-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</section><section className="settings-panel api-panel"><div className="panel-head"><div><span>AGENT INTEGRATION</span><small>Request must pass through Pevier</small></div><TerminalSquare size={17} /></div><pre><code>{snippet}</code></pre></section></div>
    <section className="youtube-uploader">
      <div className="youtube-uploader__intro"><span>PRIVATE UPLOAD PILOT</span><h2>Send one real video through the firewall.</h2><p>Pevier evaluates the metadata first. HOLD or BLOCK never reaches YouTube; ALLOW uploads privately only.</p>{uploadLock && <div className="safe-lock"><ShieldCheck size={16} />{uploadLock}</div>}</div>
      <form onSubmit={upload}>
        <label>Video title<input name="title" required minLength={3} maxLength={100} placeholder="A policy-safe test upload" /></label>
        <label>Channel<select name="channelId" defaultValue={youtube?.channelId ?? ""} disabled={!youtube?.channelId} key={youtube?.channelId ?? "unidentified"}>{youtube?.channelId ? <option value={youtube.channelId}>{youtube.accountLabel} · {youtube.channelHandle ?? youtube.channelId}</option> : <option value="">Reconnect to identify channel</option>}</select></label>
        <label className="field-wide">Description<textarea name="description" maxLength={5000} rows={4} placeholder="Describe the video for Pevier and YouTube." /></label>
        <label className="file-field field-wide"><span>Video file</span><input name="video" type="file" accept="video/*" required /><small>Local pilot limit: 128 MB. YouTube visibility is forced to private.</small></label>
        <div className="upload-checks field-wide"><label><input type="checkbox" name="humanEditorialReview" defaultChecked />Human editorial review complete</label><label><input type="checkbox" name="platformDisclosureEnabled" defaultChecked />Platform disclosure configured</label></div>
        <button className="button button--primary field-wide" type="submit" disabled={!youtube?.connected || !youtube.channelId || youtube.mode !== "LIVE" || busy !== null}>{busy === "upload" ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}{busy === "upload" ? "Evaluating and uploading…" : "Evaluate and upload privately"}</button>
        {uploadResult && <div className={`upload-result upload-result--${uploadResult.tone} field-wide`} role="status"><strong>{uploadResult.title}</strong><span>{uploadResult.detail}</span></div>}
      </form>
    </section>
    <section className="endpoint-list"><h2>API surface</h2>{[["POST", "/api/publish", "Evaluate one JSON publication request"], ["POST", "/api/platforms/youtube/upload", "Evaluate and upload one private video"], ["GET", "/api/platforms/youtube", "Read YouTube connection and mode"], ["GET", "/api/status", "Read circuit and agent state"], ["GET", "/api/audit", "Read and verify evidence"], ["POST", "/api/circuit-breaker", "Transition a scoped circuit"]].map(([method, path, copy]) => <div key={path}><Badge tone={method === "POST" ? "accent" : "neutral"}>{method}</Badge><code>{path}</code><span>{copy}</span><ChevronRight /></div>)}</section>
  </div>;
}

function DecisionDrawer({ post, onClose }: { post: (typeof queuedPosts)[number]; onClose: () => void }) {
  const held = post.decision === "HOLD";
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="decision-drawer" onMouseDown={(e) => e.stopPropagation()}><button className="drawer-close" onClick={onClose}><X /></button><div className="trace-title"><Badge>DECISION TRACE</Badge><h2>{post.id}</h2><p>{post.title}</p></div><div className="trace-summary"><span><small>Agent</small>{post.agentId}</span><span><small>Channel</small>{post.channel}</span><span><small>Risk</small><b>{post.risk} / 100</b></span><span><small>Decision</small><Badge tone={held ? "warn" : "neutral"}>{post.decision}</Badge></span></div><h3>Policy results</h3><div className="trace-policies">{[["Platform quota", true, "72 / 100 · safe"], ["Disclosure", true, "No additional review required"], ["Repetitive template", !held, held ? "Score: 81%" : "Score: 22%"], ["Cross-channel duplication", true, "Score: 18%"], ["AI sensitive persona", true, "General topic"]].map(([name, pass, detail]) => <div key={String(name)}>{pass ? <Check className="pass" /> : <AlertTriangle className="warn" />}<span><strong>{name}</strong><small>{detail}</small></span></div>)}</div><div className={`final-decision ${held ? "is-hold" : ""}`}><span>FINAL DECISION</span><strong>{held ? "HOLD" : "PENDING"}</strong><small>{held ? "Operator review required before adapter handoff." : "Awaiting scheduled gateway evaluation."}</small></div></aside></div>;
}

function PageTitle({ icon: Icon, title, copy, action }: { icon: typeof Activity; title: string; copy: string; action: React.ReactNode }) {
  return <section className="page-title"><div className="page-title__icon"><Icon /></div><div><h1>{title}</h1><p>{copy}</p></div><div className="page-title__action">{action}</div></section>;
}
