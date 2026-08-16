"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload as uploadBlob } from "@vercel/blob/client";
import { Activity, AlertTriangle, ArrowRight, Bot, Check, ChevronRight, CircleStop, Cloud, Command, Copy, Fingerprint, Gauge, Globe2, Instagram, LayoutDashboard, ListChecks, LoaderCircle, LogOut, Menu, Moon, Network, RadioTower, Search, Send, Settings, Shield, ShieldAlert, ShieldCheck, SlidersHorizontal, Sun, TerminalSquare, Trash2, Unplug, Upload, X, Youtube } from "lucide-react";
import { instagramUploadPath, isSupportedInstagramVideo, MAX_INSTAGRAM_VIDEO_BYTES } from "@/lib/instagram-media";
import type { CircuitStatus } from "@/lib/types";

type View = "Overview" | "Publish Queue" | "Portfolio" | "Policies" | "Incidents" | "Audit Log" | "Settings";
type InstagramStatus = { configured: boolean; connected: boolean; authenticated: boolean; status: string; mode: "DRY_RUN" | "LIVE"; accountId: string | null; username: string | null; accountType: string | null; accountLabel: string | null; channelId: string | null; agentId: string | null; tokenExpiresAt: string | null; tokenStoredServerSide: true; publishingImplemented: true; professionalOnly: true; publicOnly: true; safetyLock: string; accessLevel: string; lastError: string | null };
type BlueskyStatus = { configured: boolean; connected: boolean; authenticated: boolean; status: string; mode: "DRY_RUN" | "LIVE"; did: string | null; handle: string | null; accountLabel: string | null; channelId: string | null; agentId: string | null; oauthManaged: true; appPasswordStored: false; platformReviewRequired: false; safetyLock: string; lastError: string | null };
type AgentGatewayStatus = { ready: boolean; accessMode: "ACCOUNT_KEY" | "LOCAL_ONLY" | "KEY_REQUIRED"; endpoint: string; credentialsIsolated: true; credentialCount: number; lastDecision: { id: string; timestamp: string; agentId: string | null; channelId: string | null; action: string; decision: string | null; riskScore: number | null } | null };
type AuditRecord = { id: string; timestamp: string; actor: string; agentId: string | null; channelId: string | null; channelName: string | null; platform: string | null; action: string; decision: string | null; riskScore: number | null; violationCount: number; previousHash: string; hash: string };
type AuditPayload = { records: AuditRecord[]; verification: { valid: boolean; checked?: number; index?: number } };
type PolicyResult = { id?: string; name?: string; passed?: boolean; score?: number; reason?: string };
type PublicationRecord = { id: string; title: string; contentText: string; platform: string; status: string; decision: string | null; riskScore: number; scheduledAt: string | null; createdAt: string; agentId: string; channelId: string; channel: { name: string; handle: string }; policyResults: PolicyResult[] };
type PortfolioPayload = {
  channels: Array<{ id: string; name: string; handle: string; platform: string; state: string; risk: number; agentId: string }>;
  agents: Array<{ id: string; name: string; state: string; risk: number; postsToday: number; blocks: number; channels: Array<{ id: string }> }>;
};
type IncidentRecord = { id: string; title: string; severity: string; source: string; affectedPosts: number; affectedChannels: number; action: string; status: string; createdAt: string; timeline: Array<[string, string, string?]> };
type StatusPayload = { portfolio: string; agents: Array<{ id: string; state: string; risk: number }>; pending: number; mode: "DRY_RUN" | "LIVE"; connected: boolean; connectedPlatforms: string[]; agentGateway: AgentGatewayStatus };
type AgentCredential = { id: string; label: string; tokenPrefix: string; createdAt: string; lastUsedAt: string | null };
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
function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) { return <span className={`badge badge--${tone}`}>{children}</span>; }

function RiskDial({ score }: { score: number }) {
  const c = 264;
  return <div className="risk-dial" aria-label={`Risk score ${score} of 100`}><svg viewBox="0 0 120 120"><circle className="risk-dial__track" cx="60" cy="60" r="42" /><circle className={`risk-dial__value risk-dial__value--${score >= 80 ? "danger" : score >= 60 ? "warn" : "safe"}`} cx="60" cy="60" r="42" strokeDasharray={c} strokeDashoffset={c - c * score / 100} /></svg><div><strong>{String(score).padStart(2, "0")}</strong><span>/ 100</span></div></div>;
}

export function ControlRoom({ user }: { user: { name: string | null; email: string; avatarUrl: string | null } }) {
  const [view, setView] = useState<View>("Overview");
  const [dark, setDark] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [verification, setVerification] = useState<null | { valid: boolean; checked?: number; index?: number }>(null);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<PublicationRecord | null>(null);
  const [emergencyConfirm, setEmergencyConfirm] = useState(false);
  const [emergencyBusy, setEmergencyBusy] = useState(false);
  const [policies, setPolicies] = useState(initialPolicies);
  const [saved, setSaved] = useState<string | null>(null);
  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus | null>(null);
  const [blueskyStatus, setBlueskyStatus] = useState<BlueskyStatus | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioPayload>({ channels: [], agents: [] });
  const [publications, setPublications] = useState<PublicationRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const commandInput = useRef<HTMLInputElement>(null);

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  const loadControlRoom = useCallback(async () => {
    setDashboardLoading(true); setDashboardError(null); setAuditError(null);
    try {
      const responses = await Promise.all(["/api/status", "/api/portfolio", "/api/posts", "/api/incidents", "/api/audit", "/api/policies", "/api/platforms/instagram", "/api/platforms/bluesky"].map((url) => fetch(url, { cache: "no-store" })));
      if (responses.some((response) => !response.ok)) throw new Error("One or more live control-room services did not respond.");
      const [nextStatus, nextPortfolio, nextPosts, nextIncidents, nextAudit, policyOverrides, nextInstagram, nextBluesky] = await Promise.all(responses.map((response) => response.json())) as [StatusPayload, PortfolioPayload, PublicationRecord[], IncidentRecord[], AuditPayload, Array<{ policyId: string; enabled: boolean; warnAt: number | null; holdAt: number | null; blockAt: number | null }>, InstagramStatus, BlueskyStatus];
      setStatus(nextStatus); setPortfolio(nextPortfolio); setPublications(nextPosts); setIncidents(nextIncidents); setAuditRecords(nextAudit.records); setInstagramStatus(nextInstagram); setBlueskyStatus(nextBluesky);
      setPolicies(initialPolicies.map((policy) => { const override = policyOverrides.find((item) => item.policyId === policy.id); return override ? { ...policy, enabled: override.enabled, warnAt: override.warnAt ?? policy.warnAt, holdAt: override.holdAt ?? policy.holdAt, blockAt: override.blockAt ?? policy.blockAt } : policy; }));
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Live control-room data could not be loaded.");
    } finally { setDashboardLoading(false); }
  }, []);
  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view") as View | null;
    if (requestedView && nav.some((item) => item.label === requestedView)) setView(requestedView);
    void loadControlRoom();
  }, [loadControlRoom]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen((v) => !v); }
      if (event.key === "Escape") { setCommandOpen(false); setEmergencyConfirm(false); setSelectedPost(null); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (commandOpen) setTimeout(() => commandInput.current?.focus(), 0); }, [commandOpen]);

  const verify = async () => {
    setAuditLoading(true); setAuditError(null);
    try {
      const response = await fetch("/api/audit", { cache: "no-store" });
      if (!response.ok) throw new Error("The audit service could not verify the evidence chain.");
      const data = await response.json() as AuditPayload;
      setAuditRecords(data.records); setVerification(data.verification);
    } catch (error) { setAuditError(error instanceof Error ? error.message : "The audit evidence could not be verified."); }
    finally { setAuditLoading(false); }
  };
  const stopPublicPublishing = async () => {
    setEmergencyBusy(true);
    try {
      const targets = [instagramStatus?.connected ? "/api/platforms/instagram" : null, blueskyStatus?.connected ? "/api/platforms/bluesky" : null].filter((value): value is string => Boolean(value));
      const responses = await Promise.all(targets.map((url) => fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "DRY_RUN" }) })));
      if (responses.some((response) => !response.ok)) throw new Error("Public publishing could not be stopped on every connected platform.");
      await loadControlRoom();
      setEmergencyConfirm(false);
    } finally { setEmergencyBusy(false); }
  };
  const choose = (next: View) => { setView(next); setMobileNav(false); setCommandOpen(false); };

  const displayName = user.name?.trim() || user.email.split("@")[0];
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <div className="app-shell">
    <aside className={`side-rail ${mobileNav ? "is-open" : ""}`}><div className="brand"><div className="brand__mark"><Shield size={17} /></div><div><strong>PEVIER</strong><span>POLICY FIREWALL</span></div></div><nav>{nav.map((item) => <button key={item.label} className={`nav-item ${view === item.label ? "is-active" : ""}`} onClick={() => choose(item.label)}><item.icon size={17} /><span>{item.label}</span>{item.label === "Incidents" && incidents.length > 0 && <i>{incidents.length}</i>}</button>)}</nav><div className="rail-foot"><div className="connection"><span className={dashboardError ? "offline-dot" : "live-dot"} />{dashboardError ? "Gateway unavailable" : "Gateway online"}</div><button className="command-button" onClick={() => setCommandOpen(true)}><Command size={14} /><span>Command</span><kbd>⌘K</kbd></button><div className="workspace"><div className="avatar">{initials}</div><span title={user.email}>{displayName}<small>{user.email}</small></span><form action="/api/auth/logout" method="post"><button type="submit" className="workspace__logout" aria-label="Log out" title="Log out"><LogOut size={15} /></button></form></div></div></aside>
    <div className="app-main"><header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav((v) => !v)} aria-label="Open navigation">{mobileNav ? <X /> : <Menu />}</button><div><span>PEVIER /</span><strong>{view}</strong></div><div className="topbar__actions"><Badge tone={instagramStatus?.connected && instagramStatus.mode === "LIVE" ? "warn" : "neutral"}><span className={instagramStatus?.connected ? "live-dot" : "offline-dot"} /> {instagramStatus?.connected ? instagramStatus.mode === "LIVE" ? "INSTAGRAM LIVE" : "INSTAGRAM DRY RUN" : "INSTAGRAM OFF"}</Badge><Badge tone={blueskyStatus?.connected && blueskyStatus.mode === "LIVE" ? "warn" : "neutral"}><span className={blueskyStatus?.connected ? "live-dot" : "offline-dot"} /> {blueskyStatus?.connected ? blueskyStatus.mode === "LIVE" ? "BLUESKY LIVE" : "BLUESKY DRY RUN" : "BLUESKY OFF"}</Badge><button className="icon-button" onClick={() => setDark((v) => !v)} aria-label="Change theme">{dark ? <Sun size={17} /> : <Moon size={17} />}</button><button className="emergency-small" onClick={() => setEmergencyConfirm(true)} disabled={instagramStatus?.mode !== "LIVE" && blueskyStatus?.mode !== "LIVE"}><CircleStop size={15} />Stop publishing</button></div></header><main>
      {dashboardError && <div className="global-error" role="alert"><AlertTriangle size={17} /><span>{dashboardError}</span><button onClick={() => void loadControlRoom()}>Retry</button></div>}
      {view === "Overview" && <Overview status={status} portfolio={portfolio} publications={publications} incidents={incidents} audits={auditRecords} activePolicies={policies.filter((p) => p.enabled).length} instagram={instagramStatus} bluesky={blueskyStatus} loading={dashboardLoading} onSettings={() => choose("Settings")} onAudit={() => choose("Audit Log")} />}
      {view === "Publish Queue" && <PublishQueue posts={publications} loading={dashboardLoading} onSelect={setSelectedPost} />}
      {view === "Portfolio" && <Portfolio data={portfolio} loading={dashboardLoading} onSettings={() => choose("Settings")} />}
      {view === "Policies" && <Policies items={policies} setItems={setPolicies} saved={saved} setSaved={setSaved} />}
      {view === "Incidents" && <Incidents incidents={incidents} loading={dashboardLoading} />}
      {view === "Audit Log" && <AuditLog records={auditRecords} loading={auditLoading || dashboardLoading} error={auditError} verification={verification} onVerify={verify} onRetry={verify} />}
      {view === "Settings" && <SettingsView activePolicies={policies.filter((p) => p.enabled).length} instagram={instagramStatus} bluesky={blueskyStatus} onInstagramChange={setInstagramStatus} onBlueskyChange={setBlueskyStatus} onActivity={loadControlRoom} />}
    </main><footer className="foot-line"><span>PEVIER / POLICY CONTROL PLANE</span><span>Policy set v1.4 · SHA-256 evidence · {instagramStatus?.mode === "LIVE" || blueskyStatus?.mode === "LIVE" ? "PUBLIC LIVE" : "DRY RUN"}</span><span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span></footer></div>
    {commandOpen && <div className="modal-backdrop" onMouseDown={() => setCommandOpen(false)}><section className="command-palette" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><div className="command-search"><Search size={18} /><input ref={commandInput} placeholder="Go to a control surface…" /></div>{nav.map((item) => <button key={item.label} onClick={() => choose(item.label)}><item.icon size={17} /><span>Open {item.label}</span><ArrowRight size={15} /></button>)}</section></div>}
    {emergencyConfirm && <div className="modal-backdrop" onMouseDown={() => setEmergencyConfirm(false)}><section className="confirm-dialog" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><div className="danger-icon"><CircleStop /></div><h2>Stop all public publishing?</h2><p>Pevier will immediately return every connected platform to dry-run mode. Existing social posts will not be changed.</p><div><button className="button button--quiet" onClick={() => setEmergencyConfirm(false)}>Cancel</button><button className="button button--danger" onClick={() => void stopPublicPublishing()} disabled={emergencyBusy}>{emergencyBusy ? <LoaderCircle className="spin" size={16} /> : <CircleStop size={16} />}{emergencyBusy ? "Stopping…" : "Stop public publishing"}</button></div></section></div>}
    {selectedPost && <DecisionDrawer post={selectedPost} onClose={() => setSelectedPost(null)} />}
  </div>;
}

function Overview({ status, portfolio, publications, incidents, audits, activePolicies, instagram, bluesky, loading, onSettings, onAudit }: { status: StatusPayload | null; portfolio: PortfolioPayload; publications: PublicationRecord[]; incidents: IncidentRecord[]; audits: AuditRecord[]; activePolicies: number; instagram: InstagramStatus | null; bluesky: BlueskyStatus | null; loading: boolean; onSettings: () => void; onAudit: () => void }) {
  const agentState = (status?.agents[0]?.state ?? "RUNNING") as CircuitStatus;
  const risk = status?.agentGateway.lastDecision?.riskScore ?? Math.max(0, ...status?.agents.map((agent) => agent.risk) ?? [0]);
  const tone = agentState === "RUNNING" ? "safe" : agentState === "PAUSED" ? "warn" : "danger";
  const recentEvents = audits.slice(0, 6);
  const blocks = publications.filter((post) => post.decision === "BLOCK").length;
  const latestIncident = incidents[0];
  const connectedPlatforms = [instagram?.connected ? "Instagram" : null, bluesky?.connected ? "Bluesky" : null].filter(Boolean);
  const anyConnected = connectedPlatforms.length > 0;
  const anyLive = instagram?.mode === "LIVE" || bluesky?.mode === "LIVE";
  return <div className="page control-room reveal"><section className="page-intro"><div><p className="context-line"><RadioTower size={14} /> LIVE CONTROL ROOM</p><h1>Control Room</h1></div><p className="page-intro__lede">Real publication requests, policy decisions, and connected social-platform state for this signed-in account.</p><div className="intro-actions">{anyConnected ? <button className="button button--quiet" onClick={onAudit}><Fingerprint size={17} />Review evidence</button> : <button className="button button--primary" onClick={onSettings}><Globe2 size={17} />Connect a platform</button>}</div></section>
    <section className="metric-strip">{[[String(portfolio.channels.length), "Connected channels"], [String(portfolio.agents.length), "Authorized agents"], [String(status?.pending ?? 0), "Pending or held"], [String(blocks), "Blocked requests"]].map(([v, l]) => <div key={l}><strong>{loading ? "—" : v}</strong><span>{l}</span></div>)}<div className="quota"><span>Publishing connections</span><strong>{anyConnected ? anyLive ? "PUBLIC LIVE" : "DRY RUN" : "NOT CONNECTED"}</strong><i><b style={{ width: anyConnected ? "100%" : "0%" }} /></i><small>{connectedPlatforms.join(" · ") || "Connect an account in Settings"}</small></div></section>
    <section className="gateway-route" aria-label="Publishing enforcement path"><div><Bot size={17} /><span>Autonomous agents<small>{portfolio.agents.length} authorized</small></span></div><ArrowRight /><div className="gateway-route__active"><Shield size={18} /><span>Pevier gateway<small>{status?.agentGateway.ready ? "Authenticated" : "Awaiting account key"}</small></span></div><ArrowRight /><div><SlidersHorizontal size={17} /><span>Policy engine<small>{activePolicies} active rules</small></span></div><ArrowRight /><div><Globe2 size={17} /><span>Platform adapters<small>{connectedPlatforms.join(" + ") || "Disconnected"}</small></span></div></section>
    <div className="control-grid"><section className={`governor-panel governor-panel--${tone}`}><div className="panel-head"><div><span>ACCOUNT GOVERNOR</span><small>Database-backed state</small></div><Badge tone={tone}><span className="state-dot" /> {agentState}</Badge></div><div className="governor-main"><div><p>Current state</p><h2><span className="state-dot state-dot--large" />{agentState}</h2><span>{agentState === "RUNNING" ? "Requests may enter the policy gateway. Platform writes still require ALLOW and operator confirmation." : "The connected publishing agent requires operator attention."}</span></div><RiskDial score={risk} /></div><div className="state-path">{["RUNNING", "PAUSED", "HALTED", "KILLED"].map((stateName, index) => <span key={stateName} className={agentState === stateName ? "is-active" : ""}>{index > 0 && <i />}{stateName}</span>)}</div></section>
      <section className="event-panel"><div className="panel-head"><div><span>DECISION STREAM</span><small>{recentEvents.length ? `${recentEvents.length} most recent records` : "Awaiting the first request"}</small></div><Activity size={18} /></div><div className="event-stream" aria-live="polite">{!recentEvents.length && <div className="empty-state"><RadioTower /><strong>No publication decisions yet</strong><span>Connect a platform and evaluate a post to create the first live record.</span></div>}{recentEvents.map((event) => { const eventTone = event.decision === "ALLOW" ? "safe" : event.decision === "BLOCK" ? "danger" : "warn"; return <div className="event-row" key={event.id}><i className={`event-node event-node--${(event.decision ?? "state").toLowerCase()}`} /><div><strong>{event.action.replaceAll("_", " ")}</strong><span>{event.channelName ?? event.actor}</span></div><Badge tone={eventTone}>{event.decision ?? "STATE"}</Badge><time dateTime={event.timestamp}>{new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(event.timestamp))}</time></div>; })}</div></section></div>
    <section className={`containment ${latestIncident ? "is-contained" : ""}`}><div className="containment__head"><div><span className="context-line"><ShieldAlert size={14} /> INCIDENT STATUS</span><h2>{latestIncident ? latestIncident.title : "No incidents recorded."}</h2><p>{latestIncident ? `${latestIncident.source} · ${latestIncident.action}` : "Pevier will create an incident automatically when a request crosses a blocking policy threshold."}</p></div>{latestIncident ? <Badge tone="safe"><ShieldCheck size={14} /> {latestIncident.status.toUpperCase()}</Badge> : <Badge tone="safe"><Check size={14} /> CLEAR</Badge>}</div>{latestIncident && <div className="containment-stats"><div><strong>{latestIncident.affectedPosts}</strong><span>affected posts</span></div><div><strong>{latestIncident.affectedChannels}</strong><span>affected channels</span></div><div><strong>{incidents.length}</strong><span>total incidents</span></div></div>}</section>
  </div>;
}

function PublishQueue({ posts, loading, onSelect }: { posts: PublicationRecord[]; loading: boolean; onSelect: (post: PublicationRecord) => void }) {
  const held = posts.filter((post) => post.decision === "HOLD").length;
  return <div className="page reveal"><PageTitle icon={ListChecks} title="Publications" copy="Every real request evaluated for this account, including dry runs, holds, blocks, failures, and published Reels." action={<Badge>{posts.length} RECORDS</Badge>} /><div className="filter-row"><span className="filter is-active">All requests <b>{posts.length}</b></span><span className="filter">Held <b>{held}</b></span><span className="filter">Published <b>{posts.filter((post) => post.status === "LIVE_PUBLISHED").length}</b></span></div>{loading && !posts.length ? <section className="audit-state"><LoaderCircle className="spin" /><div><strong>Loading publications</strong><span>Reading this account&apos;s request history.</span></div></section> : !posts.length ? <section className="audit-state"><ListChecks /><div><strong>No publications yet</strong><span>Evaluate a post in Settings or send an authenticated agent request.</span></div></section> : <section className="data-surface"><div className="data-row data-row--head"><span>Post / channel</span><span>Agent</span><span>Platform</span><span>Created</span><span>Risk</span><span>Decision</span><span /></div>{posts.map((post) => <button className="data-row" key={post.id} onClick={() => onSelect(post)}><span><strong>{post.title}</strong><small>{post.id} · {post.channel.name}</small></span><span data-label="Agent">{post.agentId}</span><span data-label="Platform">{post.platform}</span><span data-label="Created">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.createdAt))}</span><span data-label="Risk"><i className={`risk-bar risk-bar--${post.riskScore > 40 ? "warn" : "safe"}`} style={{ "--risk": `${post.riskScore}%` } as React.CSSProperties} />{post.riskScore}</span><span data-label="Decision"><Badge tone={post.decision === "ALLOW" ? "safe" : post.decision === "BLOCK" ? "danger" : "warn"}>{post.decision ?? post.status}</Badge></span><ChevronRight size={16} /></button>)}</section>}</div>;
}

function Portfolio({ data, loading, onSettings }: { data: PortfolioPayload; loading: boolean; onSettings: () => void }) {
  if (!loading && !data.channels.length) return <div className="page reveal"><PageTitle icon={Globe2} title="Portfolio" copy="Connected social channels and their dedicated publishing agents." action={<button className="button button--primary" onClick={onSettings}><Instagram size={16} />Connect Instagram</button>} /><section className="audit-state"><Globe2 /><div><strong>No connected channels</strong><span>Connect an Instagram Professional account to create the first channel and isolated agent.</span></div></section></div>;
  return <div className="page reveal"><PageTitle icon={Globe2} title="Portfolio" copy="Connected social channels and their dedicated publishing agents." action={<Badge tone="safe">{data.channels.length} CONNECTED</Badge>} /><section className="portfolio-layout"><div className="data-surface channel-table"><div className="data-row data-row--head"><span>Channel</span><span>Platform</span><span>Risk</span><span>State</span><span>Agent</span></div>{data.channels.map((channel) => <div className="data-row" key={channel.id}><span><strong>{channel.name}</strong><small>{channel.handle}</small></span><span data-label="Platform">{channel.platform}</span><span data-label="Risk"><b className={`risk-number risk-number--${channel.risk > 40 ? "warn" : "safe"}`}>{channel.risk}</b></span><span data-label="State"><Badge tone={channel.state === "RUNNING" ? "safe" : "danger"}>{channel.state}</Badge></span><span data-label="Agent">{channel.agentId}</span></div>)}</div><aside className="agents-panel"><div className="panel-head"><div><span>AUTHORIZED PUBLISHERS</span><small>Independent circuit state</small></div><Bot size={17} /></div>{data.agents.map((agent) => <div className="agent-row" key={agent.id}><div className="agent-symbol"><Bot size={17} /></div><span><strong>{agent.name}</strong><small>{agent.postsToday} today · {agent.blocks} blocked</small></span><div><Badge tone={agent.state === "RUNNING" ? "safe" : "danger"}>{agent.state}</Badge><small>Risk {agent.risk}</small></div></div>)}</aside></section></div>;
}

function Policies({ items, setItems, saved, setSaved }: { items: typeof initialPolicies; setItems: React.Dispatch<React.SetStateAction<typeof initialPolicies>>; saved: string | null; setSaved: (v: string | null) => void }) {
  const update = (id: string, key: "enabled" | "blockAt", value: boolean | number) => { setItems((all) => all.map((item) => item.id === id ? { ...item, [key]: value } : item)); setSaved(id); fetch("/api/policies", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, [key]: value }) }).catch(() => undefined); setTimeout(() => setSaved(null), 1200); };
  return <div className="page reveal"><PageTitle icon={SlidersHorizontal} title="Policy engine" copy="Thresholds are runtime configuration. Changes affect the next gateway request." action={<Badge tone="safe">{items.filter((p) => p.enabled).length} ACTIVE</Badge>} /><div className="policy-list">{items.map((policy) => <section className="policy-row" key={policy.id}><div className="policy-copy"><div><h2>{policy.name}</h2><Badge tone={policy.severity === "CRITICAL" ? "danger" : "warn"}>{policy.severity}</Badge></div><p>{policy.description}</p><code>{policy.id}</code></div><label className="switch"><input type="checkbox" checked={policy.enabled} onChange={(e) => update(policy.id, "enabled", e.target.checked)} /><span /><b>{policy.enabled ? "ON" : "OFF"}</b></label><div className="thresholds"><span>Warn at <strong>{Math.round(policy.warnAt * 100)}%</strong></span><span>Hold at <strong>{Math.round(policy.holdAt * 100)}%</strong></span><label>Block at <strong>{Math.round(policy.blockAt * 100)}%</strong><input aria-label={`${policy.name} block threshold`} type="range" min="50" max="100" value={Math.round(policy.blockAt * 100)} onChange={(e) => update(policy.id, "blockAt", Number(e.target.value) / 100)} /></label></div><div className="save-state">{saved === policy.id ? <><Check size={14} />Saved</> : "Runtime policy"}</div></section>)}</div><p className="legal-note"><Shield size={16} />Pevier provides automated policy enforcement assistance and risk signals. Final legal and platform-policy responsibility remains with the operator.</p></div>;
}

function Incidents({ incidents, loading }: { incidents: IncidentRecord[]; loading: boolean }) {
  if (loading && !incidents.length) return <div className="page reveal"><PageTitle icon={ShieldAlert} title="Incident center" copy="Real blocking events and automatic containment actions for this account." action={<Badge>LOADING</Badge>} /><section className="audit-state"><LoaderCircle className="spin" /><div><strong>Loading incidents</strong><span>Reading containment records.</span></div></section></div>;
  if (!incidents.length) return <div className="page reveal"><PageTitle icon={ShieldAlert} title="Incident center" copy="Real blocking events and automatic containment actions for this account." action={<Badge tone="safe">0 OPEN</Badge>} /><section className="audit-state"><ShieldCheck /><div><strong>No incidents recorded</strong><span>An incident will appear here only when a real request reaches a blocking threshold.</span></div></section></div>;
  const incident = incidents[0];
  return <div className="page reveal"><PageTitle icon={ShieldAlert} title="Incident center" copy="Real blocking events and automatic containment actions for this account." action={<Badge tone="danger">{incidents.length} RECORDED</Badge>} /><section className="incident-hero"><div><div className="incident-id">{incident.id}<Badge tone="danger">{incident.severity}</Badge></div><h2>{incident.title}</h2><p>Source <strong>{incident.source}</strong> triggered a policy block and Pevier recorded the resulting containment action.</p><div className="incident-meta"><span><small>Action</small>{incident.action}</span><span><small>Status</small>{incident.status}</span><span><small>Affected</small>{incident.affectedPosts} posts / {incident.affectedChannels} channels</span></div></div><ShieldAlert className="incident-watermark" /></section><section className="timeline"><div className="panel-head"><div><span>CONTAINMENT TIMELINE</span><small>Stored machine timestamps</small></div><Activity size={17} /></div>{incident.timeline.map(([time, title, copy], index) => <div className="timeline-row" key={`${time}-${index}`}><time>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(time))}</time><i className="is-danger" /><div><strong>{title}</strong>{copy && <span>{copy}</span>}</div>{index === incident.timeline.length - 1 && <Badge tone="safe">SEALED</Badge>}</div>)}</section>{incidents.length > 1 && <section className="incident-list"><h2>Earlier incidents</h2>{incidents.slice(1).map((item) => <div key={item.id}><span><strong>{item.id}</strong><small>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.createdAt))}</small></span><span>{item.title}</span><Badge tone={item.status.toLowerCase().includes("contain") ? "safe" : "warn"}>{item.status}</Badge></div>)}</section>}</div>;
}

function shortHash(value: string) {
  return value === "GENESIS" ? value : `${value.slice(0, 7)}…${value.slice(-4)}`;
}

function AuditLog({ records, loading, error, verification, onVerify, onRetry }: {
  records: AuditRecord[];
  loading: boolean;
  error: string | null;
  verification: null | { valid: boolean; checked?: number; index?: number };
  onVerify: () => void;
  onRetry: () => void;
}) {
  return <div className="page reveal">
    <PageTitle icon={Fingerprint} title="Audit evidence" copy="Live policy decisions and state transitions, linked record by record with SHA-256." action={<button className="button button--primary" onClick={onVerify} disabled={loading || !records.length}>{loading ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />}{loading ? "Checking chain…" : "Verify chain"}</button>} />
    {verification && <section className={`verification ${verification.valid ? "is-valid" : "is-invalid"}`} role="status"><div>{verification.valid ? <ShieldCheck /> : <ShieldAlert />}<span><strong>{verification.valid ? "Chain integrity verified" : "Chain invalid"}</strong><small>{verification.valid ? `${verification.checked ?? records.length} records checked · hashes and links valid` : `Change detected at chronological record #${(verification.index ?? 0) + 1}`}</small></span></div><div>{verification.valid ? <><span><Check />Hashes valid</span><span><Check />Links valid</span><span><Check />No modified records</span></> : <><span><X />Record content changed</span><span><X />Downstream link compromised</span></>}</div></section>}
    {error && <section className="audit-state audit-state--error" role="alert"><AlertTriangle /><div><strong>Audit evidence unavailable</strong><span>{error}</span></div><button className="button button--quiet" onClick={onRetry}>Try again</button></section>}
    {!error && loading && !records.length && <section className="audit-state" aria-live="polite"><LoaderCircle className="spin" /><div><strong>Loading live evidence</strong><span>Reading the local audit chain and resolving channel identities.</span></div></section>}
    {!error && !loading && !records.length && <section className="audit-state"><Fingerprint /><div><strong>No audit evidence yet</strong><span>Evaluate a publication to create the first cryptographically linked record.</span></div></section>}
    {!!records.length && <section className="audit-chain" aria-label={`${records.length} live audit records`}><div className="audit-head"><span>Record / channel</span><span>Timestamp</span><span>Decision / action</span><span>Previous hash</span><span>SHA-256</span></div>{records.map((record) => {
      const tone = record.decision === "ALLOW" ? "safe" : record.decision === "HOLD" ? "warn" : record.decision === "BLOCK" ? "danger" : "neutral";
      return <div className="audit-row" key={record.id}>
        <span className="audit-record"><Fingerprint size={14} /><span><strong>AUD-{record.id.slice(0, 8).toUpperCase()}</strong><small title={record.channelId ?? undefined}>{record.channelName ?? "Portfolio control plane"}</small></span></span>
        <time dateTime={record.timestamp}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(record.timestamp))}</time>
        <span className="audit-action"><span><Badge tone={tone}>{record.decision ?? "STATE"}</Badge><strong>{record.action}</strong></span><small>{record.actor}{record.platform ? ` · ${record.platform}` : ""}{record.riskScore !== null ? ` · risk ${record.riskScore}` : ""}{record.violationCount ? ` · ${record.violationCount} violation${record.violationCount === 1 ? "" : "s"}` : ""}</small></span>
        <code title={record.previousHash}>{shortHash(record.previousHash)}</code>
        <code title={record.hash}>{shortHash(record.hash)}</code>
      </div>;
    })}</section>}
  </div>;
}

function SettingsView({ activePolicies, instagram, bluesky, onInstagramChange, onBlueskyChange, onActivity }: { activePolicies: number; instagram: InstagramStatus | null; bluesky: BlueskyStatus | null; onInstagramChange: (status: InstagramStatus) => void; onBlueskyChange: (status: BlueskyStatus) => void; onActivity: () => Promise<void> }) {
  const [busy, setBusy] = useState<"instagram" | "bluesky" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [instagramResult, setInstagramResult] = useState<{ tone: string; title: string; detail: string; evidence?: string } | null>(null);
  const [blueskyResult, setBlueskyResult] = useState<{ tone: string; title: string; detail: string; evidence?: string } | null>(null);
  const [instagramStage, setInstagramStage] = useState<"uploading" | "evaluating" | "publishing" | null>(null);
  const [instagramUploadProgress, setInstagramUploadProgress] = useState(0);
  const [agentGateway, setAgentGateway] = useState<AgentGatewayStatus | null>(null);
  const [agentStatusError, setAgentStatusError] = useState(false);
  const [agentCredentials, setAgentCredentials] = useState<AgentCredential[]>([]);
  const [issuedAgentToken, setIssuedAgentToken] = useState<string | null>(null);
  const [agentKeyBusy, setAgentKeyBusy] = useState(false);
  const snippet = ['const response = await fetch("https://pevier.vercel.app/api/publish", {', '  method: "POST",', '  headers: {', '    "content-type": "application/json",', '    authorization: `Bearer ${PEVIER_ACCOUNT_KEY}`', '  },', '  body: JSON.stringify(post)', '});', '', 'const result = await response.json();'].join("\n");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const instagramResult = params.get("instagram");
    const blueskyResult = params.get("bluesky");
    const instagramMessages: Record<string, string> = {
      connected: "Instagram connected. Pevier kept public publishing locked in dry-run mode.",
      denied: "Instagram authorization was cancelled.",
      "missing-config": "Add the Instagram OAuth values to the server before connecting.",
      "invalid-state": "The Instagram OAuth state check failed. Please try connecting again.",
      "missing-code": "Instagram returned no authorization code. Please try connecting again.",
      "connection-failed": "Instagram could not be connected. Confirm the redirect URI, app secret, tester role, and Professional account.",
    };
    if (instagramResult && instagramMessages[instagramResult]) setNotice(instagramMessages[instagramResult]);
    const blueskyMessages: Record<string, string> = {
      connected: "Bluesky connected through OAuth. Pevier kept public publishing locked in dry-run mode.",
      "missing-config": "Add the Bluesky OAuth signing key to the server before connecting.",
      "missing-handle": "Enter your complete Bluesky handle before connecting.",
      "invalid-state": "The Bluesky OAuth state check failed. Please try connecting again.",
      "authorization-failed": "Bluesky could not start authorization. Confirm the handle and try again.",
      "connection-failed": "Bluesky could not complete the OAuth connection. Nothing was stored as connected.",
    };
    if (blueskyResult && blueskyMessages[blueskyResult]) setNotice(blueskyMessages[blueskyResult]);
    Promise.all([fetch("/api/status", { cache: "no-store" }), fetch("/api/agent-credentials", { cache: "no-store" })])
      .then(async ([statusResponse, credentialsResponse]) => { if (!statusResponse.ok || !credentialsResponse.ok) throw new Error(); return Promise.all([statusResponse.json(), credentialsResponse.json()]); })
      .then(([data, credentials]) => { setAgentGateway(data.agentGateway); setAgentCredentials(credentials); })
      .catch(() => setAgentStatusError(true));
  }, []);

  const createAgentCredential = async () => {
    setAgentKeyBusy(true); setIssuedAgentToken(null);
    try {
      const response = await fetch("/api/agent-credentials", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "Production publisher" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create an account API key.");
      setIssuedAgentToken(data.token);
      setAgentCredentials((items) => [{ id: data.id, label: data.label, tokenPrefix: data.tokenPrefix, createdAt: data.createdAt, lastUsedAt: null }, ...items]);
      setAgentGateway((current) => current ? { ...current, ready: true, accessMode: "ACCOUNT_KEY", credentialCount: current.credentialCount + 1 } : current);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not create an account API key."); }
    finally { setAgentKeyBusy(false); }
  };

  const revokeAgentCredential = async (id: string) => {
    setAgentKeyBusy(true);
    try {
      const response = await fetch("/api/agent-credentials", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not revoke the account API key.");
      setAgentCredentials((items) => items.filter((item) => item.id !== id));
      setIssuedAgentToken(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not revoke the account API key."); }
    finally { setAgentKeyBusy(false); }
  };

  const updateInstagramMode = async (mode: "DRY_RUN" | "LIVE") => {
    setBusy("instagram"); setNotice(null);
    try {
      const response = await fetch("/api/platforms/instagram", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not change Instagram mode.");
      onInstagramChange(data);
      await onActivity();
      setNotice(mode === "LIVE" ? "Instagram live publishing is armed. Every Reel still needs explicit public confirmation." : "Instagram returned to dry run. Meta will receive nothing.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not change Instagram mode.");
    } finally { setBusy(null); }
  };

  const disconnectInstagramAccount = async () => {
    setBusy("instagram"); setNotice(null);
    try {
      const response = await fetch("/api/platforms/instagram", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not disconnect Instagram.");
      onInstagramChange(data);
      await onActivity();
      setNotice("Instagram disconnected and its encrypted token was removed from Pevier.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not disconnect Instagram.");
    } finally { setBusy(null); }
  };

  const updateBlueskyMode = async (mode: "DRY_RUN" | "LIVE") => {
    setBusy("bluesky"); setNotice(null);
    try {
      const response = await fetch("/api/platforms/bluesky", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not change Bluesky mode.");
      onBlueskyChange(data);
      await onActivity();
      setNotice(mode === "LIVE" ? "Bluesky live publishing is armed. Every post still needs explicit public confirmation." : "Bluesky returned to dry run. No post will be sent to the network.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not change Bluesky mode.");
    } finally { setBusy(null); }
  };

  const disconnectBlueskyAccount = async () => {
    setBusy("bluesky"); setNotice(null);
    try {
      const response = await fetch("/api/platforms/bluesky", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not disconnect Bluesky.");
      onBlueskyChange(data);
      await onActivity();
      setNotice("Bluesky disconnected and its encrypted OAuth session was removed from Pevier.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not disconnect Bluesky.");
    } finally { setBusy(null); }
  };

  const submitBluesky = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy("bluesky"); setBlueskyResult(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      text: String(form.get("text") ?? ""),
      syntheticMedia: Boolean(form.get("syntheticMedia")),
      humanEditorialReview: Boolean(form.get("humanEditorialReview")),
      confirmPublicPublish: Boolean(form.get("confirmPublicPublish")),
    };
    try {
      const response = await fetch("/api/platforms/bluesky/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (data.publication?.published) setBlueskyResult({ tone: "safe", title: "Public Bluesky post published", detail: `${data.execution?.destination ?? "Bluesky"} received the policy-approved post.`, evidence: data.decisionId });
      else if (data.decision === "ALLOW") setBlueskyResult({ tone: response.ok ? "safe" : "danger", title: response.ok ? "Policy preview passed" : "Bluesky publish failed safely", detail: response.ok ? `${data.execution?.destination ?? "Bluesky"} received no post because this connection is in dry-run mode. The decision was recorded in Pevier.` : data.publication?.reason ?? data.error ?? "Bluesky did not confirm a published post.", evidence: data.decisionId });
      else if (data.decision === "HOLD" || data.decision === "BLOCK") setBlueskyResult({ tone: data.decision === "BLOCK" ? "danger" : "warn", title: `${data.decision}: publication stopped`, detail: `Risk ${data.riskScore}/100. The policy firewall stopped before the Bluesky adapter.`, evidence: data.decisionId });
      else setBlueskyResult({ tone: "danger", title: "Evaluation failed safely", detail: data.error ?? "No request was sent to Bluesky." });
      await onActivity();
    } catch (error) {
      setBlueskyResult({ tone: "danger", title: "Bluesky publish failed safely", detail: error instanceof Error ? error.message : "The request could not reach Pevier. Nothing was sent to Bluesky." });
    } finally { setBusy(null); }
  };

  const submitInstagram = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy("instagram"); setInstagramResult(null);
    const form = new FormData(event.currentTarget);
    form.set("syntheticMedia", form.get("syntheticMedia") ? "true" : "false");
    form.set("humanEditorialReview", form.get("humanEditorialReview") ? "true" : "false");
    form.set("platformDisclosureEnabled", form.get("platformDisclosureEnabled") ? "true" : "false");
    form.set("confirmPublicPublish", form.get("confirmPublicPublish") ? "true" : "false");
    if (instagram?.mode === "LIVE") form.set("format", "REEL");
    let temporaryBlobUrl: string | null = null;
    try {
      if (instagram?.mode === "LIVE") {
        const media = form.get("media");
        if (!(media instanceof File) || !isSupportedInstagramVideo(media)) {
          const limit = Math.round(MAX_INSTAGRAM_VIDEO_BYTES / 1024 / 1024);
          throw new Error(`Choose an MP4 or MOV video smaller than ${limit} MB.`);
        }
        if (!instagram.accountId) throw new Error("Reconnect Instagram before uploading a Reel.");

        setInstagramStage("uploading");
        setInstagramUploadProgress(0);
        const blob = await uploadBlob(instagramUploadPath(instagram.accountId, media.name), media, {
          access: "public",
          handleUploadUrl: "/api/platforms/instagram/upload",
          contentType: media.type,
          multipart: media.size > 100 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setInstagramUploadProgress(Math.round(percentage)),
        });
        temporaryBlobUrl = blob.url;
        form.delete("media");
        form.set("videoUrl", blob.url);
        setInstagramStage("publishing");
      } else {
        setInstagramStage("evaluating");
      }

      const response = await fetch("/api/platforms/instagram/publish", { method: "POST", body: form });
      const data = await response.json();
      if (data.publication?.published) setInstagramResult({ tone: "safe", title: "Public Reel published", detail: `Instagram media ${data.publication.externalId} passed policy and was published publicly to ${data.execution?.destination ?? "Instagram"}.`, evidence: data.decisionId });
      else if (data.decision === "ALLOW") setInstagramResult({ tone: response.ok ? "safe" : "danger", title: response.ok ? "Policy preview passed" : "Instagram publish failed safely", detail: response.ok ? `${data.execution?.destination ?? "Instagram"} received no post because this connection is in dry-run mode. The decision was recorded in Pevier.` : data.publication?.reason ?? data.error ?? "Instagram did not confirm a published Reel.", evidence: data.decisionId });
      else if (data.decision === "HOLD" || data.decision === "BLOCK") setInstagramResult({ tone: data.decision === "BLOCK" ? "danger" : "warn", title: `${data.decision}: publication stopped`, detail: `Risk ${data.riskScore}/100. The policy firewall stopped before the Instagram adapter.`, evidence: data.decisionId });
      else setInstagramResult({ tone: "danger", title: "Evaluation failed safely", detail: data.error ?? "No request was sent to Instagram." });
      await onActivity();
    } catch (error) {
      if (temporaryBlobUrl) {
        await fetch("/api/platforms/instagram/upload", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: temporaryBlobUrl }),
        }).catch(() => undefined);
      }
      setInstagramResult({ tone: "danger", title: "Instagram publish failed safely", detail: error instanceof Error ? error.message : "The request could not reach Pevier. Nothing was sent to Instagram." });
    } finally {
      setInstagramStage(null);
      setInstagramUploadProgress(0);
      setBusy(null);
    }
  };
  const instagramLive = instagram?.connected && instagram.mode === "LIVE";
  const blueskyLive = bluesky?.connected && bluesky.mode === "LIVE";
  return <div className="page reveal">
    <PageTitle icon={Settings} title="Gateway settings" copy="Connect a publisher without giving autonomous agents direct platform credentials." action={<Badge tone="safe"><span className="live-dot" /> API ONLINE</Badge>} />
    {notice && <div className="integration-notice" role="status"><Shield size={16} /><span>{notice}</span></div>}
    <section className="instagram-connection">
      <div className="platform-connection__identity"><div className="instagram-mark"><Instagram /></div><div><span>{instagramLive ? "LIVE PUBLIC ADAPTER" : "PUBLISH ADAPTER"}</span><h2>Instagram</h2><p>Policy-gated Reel publishing for a verified Professional account.</p></div></div>
      <div className="platform-connection__status">
        <Badge tone={instagram?.connected ? "safe" : instagram?.status === "ERROR" ? "danger" : "neutral"}><span className={instagram?.connected ? "live-dot" : "offline-dot"} /> {instagram?.connected ? "CONNECTED" : instagram?.status === "ERROR" ? "TOKEN ERROR" : "DISCONNECTED"}</Badge>
        <strong>{instagram?.connected ? instagram.accountLabel ?? `@${instagram.username ?? "professional-account"}` : instagram?.configured ? "Ready for Instagram Login" : "OAuth configuration required"}</strong>
        <small>{instagram?.connected ? `${instagram.accountType ?? "PROFESSIONAL"} · encrypted per-user token` : instagram?.lastError ?? "Connect a Business or Creator account. Personal accounts are not supported by Meta's publishing API."}</small>
      </div>
      <div className="platform-connection__actions">
        {!instagram?.configured && <div className="config-callout"><code>INSTAGRAM_APP_ID</code><code>INSTAGRAM_APP_SECRET</code><code>INSTAGRAM_REDIRECT_URI</code></div>}
        {instagram?.configured && !instagram.connected && <div className="platform-requirement" role="note"><AlertTriangle size={17} /><span><strong>Business or Creator account required</strong><small>Personal Instagram accounts cannot connect to publishing tools.</small></span></div>}
        {instagram?.configured && !instagram.connected && <a className="button button--primary" href="/api/platforms/instagram/connect"><Instagram size={17} />Connect Instagram</a>}
        {instagram?.connected && <><div className="mode-switch" aria-label="Instagram publisher mode"><button className={instagram.mode === "DRY_RUN" ? "is-active" : ""} disabled={busy !== null} onClick={() => updateInstagramMode("DRY_RUN")}>Dry run</button><button className={instagram.mode === "LIVE" ? "is-active" : ""} disabled={busy !== null} onClick={() => updateInstagramMode("LIVE")}>Live public</button></div><button className="button button--quiet" disabled={busy !== null} onClick={disconnectInstagramAccount}>{busy === "instagram" ? <LoaderCircle className="spin" size={16} /> : <Unplug size={16} />}Disconnect</button></>}
        <small>{instagramLive ? "Every live Reel requires explicit confirmation. Pevier handles the temporary media transfer." : "Standard Access works for app-role accounts. Other Professional accounts require Meta Advanced Access."}</small>
      </div>
    </section>
    <section className="instagram-connection bluesky-connection">
      <div className="platform-connection__identity"><div className="bluesky-mark"><Cloud /></div><div><span>{blueskyLive ? "LIVE PUBLIC ADAPTER" : "AT PROTOCOL ADAPTER"}</span><h2>Bluesky</h2><p>Policy-gated text publishing through account-owned OAuth.</p></div></div>
      <div className="platform-connection__status">
        <Badge tone={bluesky?.connected ? "safe" : bluesky?.status === "ERROR" ? "danger" : "neutral"}><span className={bluesky?.connected ? "live-dot" : "offline-dot"} /> {bluesky?.connected ? "CONNECTED" : bluesky?.status === "ERROR" ? "SESSION ERROR" : "DISCONNECTED"}</Badge>
        <strong>{bluesky?.connected ? bluesky.accountLabel ?? bluesky.handle ?? "Bluesky account" : bluesky?.configured ? "Ready for Bluesky OAuth" : "OAuth signing key required"}</strong>
        <small>{bluesky?.connected ? "OAuth session encrypted per user · no app password stored" : bluesky?.lastError ?? "Works with Bluesky and compatible AT Protocol accounts. No platform app review is required."}</small>
      </div>
      <div className="platform-connection__actions">
        {!bluesky?.configured && <div className="config-callout"><code>BLUESKY_PUBLIC_URL</code><code>BLUESKY_OAUTH_PRIVATE_KEY</code></div>}
        {bluesky?.configured && !bluesky.connected && <a className="button button--primary" href="/api/platforms/bluesky/connect"><Cloud size={17} />Connect Bluesky</a>}
        {bluesky?.connected && <><div className="mode-switch" aria-label="Bluesky publisher mode"><button className={bluesky.mode === "DRY_RUN" ? "is-active" : ""} disabled={busy !== null} onClick={() => updateBlueskyMode("DRY_RUN")}>Dry run</button><button className={bluesky.mode === "LIVE" ? "is-active" : ""} disabled={busy !== null} onClick={() => updateBlueskyMode("LIVE")}>Live public</button></div><button className="button button--quiet" disabled={busy !== null} onClick={disconnectBlueskyAccount}>{busy === "bluesky" ? <LoaderCircle className="spin" size={16} /> : <Unplug size={16} />}Disconnect</button></>}
        <small>{blueskyLive ? "Every live post requires explicit confirmation after the Pevier policy decision." : "Bluesky opens its secure account selector. Pevier never receives the account password."}</small>
      </div>
    </section>
    <div className="platform-roadmap" aria-label="Upcoming platform adapters">
      <section className="platform-coming-soon" aria-label="YouTube integration coming soon">
        <div className="youtube-mark"><Youtube /></div>
        <div><span>NEXT ADAPTER</span><h2>YouTube</h2><p>Connection and upload controls will return in a future release.</p></div>
        <Badge tone="neutral">COMING SOON</Badge>
      </section>
      <section className="platform-coming-soon" aria-label="X integration coming soon">
        <div className="x-mark" aria-hidden="true">X</div>
        <div><span>PLANNED ADAPTER</span><h2>X <small>(Twitter)</small></h2><p>Policy-gated posting and account connection are on the roadmap.</p></div>
        <Badge tone="neutral">COMING SOON</Badge>
      </section>
    </div>
    {instagram?.connected && <section className="instagram-simulator">
      <div className="instagram-simulator__intro"><span>{instagramLive ? "LIVE REEL PUBLISHER" : "POLICY PREVIEW"}</span><h2>{instagramLive ? "Publish one Reel through the firewall." : "Evaluate content without a platform write."}</h2><p>{instagramLive ? "Choose a video from your computer. Pevier uploads it temporarily, evaluates the post, and gives Meta access only long enough to publish." : "Pevier evaluates the real caption and media, saves the decision to your publication history, and stops before contacting Meta."}</p><div className={`safe-lock ${instagramLive ? "safe-lock--public" : ""}`}><ShieldCheck size={16} />{instagramLive ? "Public confirmation required on every Reel" : "Dry run · decision saved · Meta not contacted"}</div></div>
      <form className="instagram-form" onSubmit={submitInstagram}>
        <label className="instagram-field"><span>Caption</span><textarea name="caption" required minLength={3} maxLength={2200} rows={5} placeholder="Write the caption Pevier should evaluate." /></label>
        <div className="instagram-media-fields">
          <label className="instagram-field"><span>Post format</span><select name="format" defaultValue={instagramLive ? "REEL" : "FEED"} disabled={instagramLive} key={instagramLive ? "live" : "dry"}><option value="FEED">Feed post</option><option value="REEL">Reel</option></select></label>
          {instagramLive
            ? <label className="instagram-field instagram-file-field"><span>Reel video</span><input name="media" type="file" accept="video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v" required /><small>MP4 or MOV · maximum 128 MB · temporary copy removed after Meta imports it</small></label>
            : <label className="instagram-field instagram-file-field"><span>Media file</span><input name="media" type="file" accept="image/*,video/*" required /><small>Image or video · maximum 128 MB · remains inside Pevier</small></label>}
        </div>
        <fieldset className="instagram-review-options"><legend>Review signals</legend><label><input type="checkbox" name="syntheticMedia" /><span>Contains synthetic media</span></label><label><input type="checkbox" name="humanEditorialReview" defaultChecked /><span>Human editorial review complete</span></label><label><input type="checkbox" name="platformDisclosureEnabled" defaultChecked /><span>Instagram disclosure configured</span></label>{instagramLive && <label className="instagram-public-confirmation"><input type="checkbox" name="confirmPublicPublish" required /><span>I approve publishing this Reel publicly</span></label>}</fieldset>
        {instagramStage === "uploading" && <div className="instagram-upload-progress" role="status" aria-live="polite"><div><span>Uploading temporary video</span><strong>{instagramUploadProgress}%</strong></div><progress max="100" value={instagramUploadProgress}>Uploading {instagramUploadProgress}%</progress><small>Keep this page open. Nothing reaches Instagram until the policy check passes.</small></div>}
        <button className="button button--primary instagram-submit" type="submit" disabled={!instagram?.connected || busy !== null}>{busy === "instagram" ? <LoaderCircle className="spin" size={17} /> : instagramLive ? <Upload size={17} /> : <ShieldCheck size={17} />}{busy === "instagram" ? instagramStage === "uploading" ? `Uploading video · ${instagramUploadProgress}%` : instagramStage === "publishing" ? "Evaluating and publishing…" : "Evaluating policy…" : instagram?.connected ? instagramLive ? "Evaluate and publish public Reel" : "Run policy preview" : "Connect Instagram first"}</button>
        {instagramResult && <div className={`upload-result upload-result--${instagramResult.tone}`} role="status"><strong>{instagramResult.title}</strong><span>{instagramResult.detail}</span>{instagramResult.evidence && <small>Evidence {instagramResult.evidence}</small>}</div>}
      </form>
    </section>}
    {bluesky?.connected && <section className="instagram-simulator bluesky-publisher">
      <div className="instagram-simulator__intro"><span>{blueskyLive ? "LIVE TEXT PUBLISHER" : "POLICY PREVIEW"}</span><h2>{blueskyLive ? "Publish one Bluesky post through the firewall." : "Evaluate a Bluesky post without a network write."}</h2><p>{blueskyLive ? "Write the exact post, review the safety signals, and explicitly confirm the public write. Pevier publishes only after an ALLOW decision." : "Pevier evaluates the real text and saves the decision, but does not contact the user's PDS."}</p><div className={`safe-lock ${blueskyLive ? "safe-lock--public" : ""}`}><ShieldCheck size={16} />{blueskyLive ? "Public confirmation required on every post" : "Dry run · decision saved · Bluesky not contacted"}</div></div>
      <form className="instagram-form" onSubmit={submitBluesky}>
        <label className="instagram-field"><span>Post text</span><textarea name="text" required rows={6} placeholder="Write the Bluesky post Pevier should evaluate." /><small>Maximum 300 grapheme characters. Links and mentions are detected during live publishing.</small></label>
        <fieldset className="instagram-review-options"><legend>Review signals</legend><label><input type="checkbox" name="syntheticMedia" /><span>Contains AI-generated or synthetic claims</span></label><label><input type="checkbox" name="humanEditorialReview" defaultChecked /><span>Human editorial review complete</span></label>{blueskyLive && <label className="instagram-public-confirmation"><input type="checkbox" name="confirmPublicPublish" required /><span>I approve publishing this post publicly</span></label>}</fieldset>
        <button className="button button--primary instagram-submit" type="submit" disabled={!bluesky.connected || busy !== null}>{busy === "bluesky" ? <LoaderCircle className="spin" size={17} /> : blueskyLive ? <Send size={17} /> : <ShieldCheck size={17} />}{busy === "bluesky" ? "Evaluating policy…" : blueskyLive ? "Evaluate and publish public post" : "Run policy preview"}</button>
        {blueskyResult && <div className={`upload-result upload-result--${blueskyResult.tone}`} role="status"><strong>{blueskyResult.title}</strong><span>{blueskyResult.detail}</span>{blueskyResult.evidence && <small>Evidence {blueskyResult.evidence}</small>}</div>}
      </form>
    </section>}
    <section className="agent-bridge">
      <div className="agent-bridge__intro"><div className="agent-symbol"><Bot size={19} /></div><div><span>PRODUCTION AGENT API</span><h2>Publisher bridge</h2><p>Create an account-scoped key for your own autonomous publisher. The key can submit metadata but never receives social OAuth credentials or permission to confirm a public write.</p></div></div>
      <div className="agent-route" aria-label="Autonomous agent enforcement path"><span><Bot size={16} /><strong>Your agent</strong><small>Account-key authenticated</small></span><ArrowRight /><span><Shield size={16} /><strong>POST /api/publish</strong><small>Owner-scoped records</small></span><ArrowRight /><span><SlidersHorizontal size={16} /><strong>Policy firewall</strong><small>ALLOW · HOLD · BLOCK</small></span></div>
      <div className="agent-bridge__status">
        <Badge tone={agentStatusError ? "danger" : agentGateway?.ready ? "safe" : "warn"}><span className={agentGateway?.ready ? "live-dot" : "offline-dot"} /> {agentStatusError ? "UNAVAILABLE" : agentGateway?.ready ? "READY" : "CHECKING"}</Badge>
        <span><small>Access</small><strong>{agentGateway?.accessMode === "ACCOUNT_KEY" ? "Account scoped" : agentGateway?.accessMode === "KEY_REQUIRED" ? "Create a key" : "Local only"}</strong></span>
        <span><small>OAuth boundary</small><strong>{agentGateway?.credentialsIsolated ? "Isolated" : "Checking"}</strong></span>
        <span><small>Last decision</small><strong>{agentGateway?.lastDecision?.decision ? `${agentGateway.lastDecision.decision} · risk ${agentGateway.lastDecision.riskScore ?? 0}` : "Awaiting agent"}</strong></span>
      </div>
      <div className="agent-key-manager">
        <div><span>ACCOUNT API KEYS</span><small>Keys are shown once. Store them in your agent&apos;s secret manager.</small></div>
        <button className="button button--primary" onClick={() => void createAgentCredential()} disabled={agentKeyBusy || (!instagram?.connected && !bluesky?.connected)}>{agentKeyBusy ? <LoaderCircle className="spin" size={16} /> : <TerminalSquare size={16} />}Create account key</button>
        {issuedAgentToken && <div className="issued-agent-key" role="status"><div><strong>Copy this key now</strong><small>It cannot be displayed again.</small></div><code>{issuedAgentToken}</code><button className="icon-button" onClick={() => void navigator.clipboard.writeText(issuedAgentToken)} aria-label="Copy account API key"><Copy size={15} /></button></div>}
        {agentCredentials.map((credential) => <div className="agent-key-row" key={credential.id}><span><strong>{credential.label}</strong><small>{credential.tokenPrefix}… · created {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(credential.createdAt))}</small></span><span>{credential.lastUsedAt ? `Used ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(credential.lastUsedAt))}` : "Never used"}</span><button className="icon-button" onClick={() => void revokeAgentCredential(credential.id)} disabled={agentKeyBusy} aria-label={`Revoke ${credential.label}`}><Trash2 size={15} /></button></div>)}
        {!agentCredentials.length && !issuedAgentToken && <p className="agent-key-empty">No account key exists yet. Connect a platform, then create one for your production agent.</p>}
      </div>
    </section>
    <div className="settings-grid"><section className="settings-panel"><div className="panel-head"><div><span>RUNTIME</span><small>Per-user social connections</small></div><Gauge size={17} /></div>{[["Instagram mode", instagram?.connected ? instagram.mode : "DISCONNECTED"], ["Bluesky mode", bluesky?.connected ? bluesky.mode : "DISCONNECTED"], ["Instagram agent", instagram?.agentId ?? "CONNECT INSTAGRAM"], ["Bluesky agent", bluesky?.agentId ?? "CONNECT BLUESKY"], ["Account API keys", String(agentCredentials.length)], ["Policy set", `${activePolicies} active`], ["Audit digest", "SHA-256"]].map(([label, value]) => <div className="setting-row" key={label}><span>{label}</span><strong title={value}>{value}</strong></div>)}</section><section className="settings-panel api-panel"><div className="panel-head"><div><span>AGENT INTEGRATION</span><small>Request must pass through Pevier</small></div><TerminalSquare size={17} /></div><pre><code>{snippet}</code></pre></section></div>
    <section className="endpoint-list"><h2>API surface</h2>{[["POST", "/api/publish", "Evaluate one authenticated agent request"], ["GET", "/api/posts", "Read the current user's publication history"], ["GET", "/api/platforms/instagram", "Read the current user's Instagram connection"], ["POST", "/api/platforms/instagram/publish", "Evaluate a policy preview or confirmed public Reel"], ["GET", "/api/platforms/bluesky", "Read the current user's Bluesky connection"], ["POST", "/api/platforms/bluesky/publish", "Evaluate or publish a confirmed Bluesky post"], ["GET", "/api/status", "Read account circuit and agent state"], ["GET", "/api/audit", "Read and verify evidence"]].map(([method, path, copy]) => <div key={path}><Badge tone={method === "POST" ? "accent" : "neutral"}>{method}</Badge><code>{path}</code><span>{copy}</span><ChevronRight /></div>)}</section>
  </div>;
}

function DecisionDrawer({ post, onClose }: { post: PublicationRecord; onClose: () => void }) {
  const held = post.decision === "HOLD";
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="decision-drawer" onMouseDown={(e) => e.stopPropagation()}><button className="drawer-close" onClick={onClose}><X /></button><div className="trace-title"><Badge>DECISION TRACE</Badge><h2>{post.id}</h2><p>{post.title}</p></div><div className="trace-summary"><span><small>Agent</small>{post.agentId}</span><span><small>Channel</small>{post.channel.name}</span><span><small>Risk</small><b>{post.riskScore} / 100</b></span><span><small>Decision</small><Badge tone={post.decision === "ALLOW" ? "safe" : held ? "warn" : "danger"}>{post.decision ?? post.status}</Badge></span></div><h3>Policy results</h3><div className="trace-policies">{post.policyResults.length ? post.policyResults.map((result, index) => <div key={result.id ?? result.name ?? index}>{result.passed ? <Check className="pass" /> : <AlertTriangle className="warn" />}<span><strong>{result.name ?? result.id ?? "Policy check"}</strong><small>{result.reason ?? (result.score !== undefined ? `Score ${Math.round(result.score * 100)}%` : result.passed ? "Passed" : "Failed")}</small></span></div>) : <div><Check className="pass" /><span><strong>No policy details stored</strong><small>The final gateway decision remains recorded.</small></span></div>}</div><div className={`final-decision ${held ? "is-hold" : ""}`}><span>FINAL DECISION</span><strong>{post.decision ?? post.status}</strong><small>{post.status === "LIVE_PUBLISHED" ? "Instagram confirmed the public media identifier." : post.status === "DRY_RUN_PUBLISHED" ? "Decision recorded without a platform write." : held ? "Operator review required before adapter handoff." : "The gateway recorded this request state."}</small></div></aside></div>;
}

function PageTitle({ icon: Icon, title, copy, action }: { icon: typeof Activity; title: string; copy: string; action: React.ReactNode }) {
  return <section className="page-title"><div className="page-title__icon"><Icon /></div><div><h1>{title}</h1><p>{copy}</p></div><div className="page-title__action">{action}</div></section>;
}
