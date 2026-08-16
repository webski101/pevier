import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Fingerprint, Robot, Shield, SlidersHorizontal, YoutubeLogo } from "@phosphor-icons/react/dist/ssr";
import { LandingMotion } from "@/components/landing-motion";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const workflow = [
  { icon: Robot, title: "Request", copy: "An agent submits the caption, media, destination, and publishing intent." },
  { icon: SlidersHorizontal, title: "Evaluate", copy: "Pevier checks disclosure, cadence, duplication, and account policy." },
  { icon: Shield, title: "Enforce", copy: "ALLOW moves forward. HOLD and BLOCK stop before the platform adapter." },
  { icon: Fingerprint, title: "Record", copy: "Every decision joins a tamper-evident audit chain with its policy evidence." },
];

const authMessages: Record<string, string> = {
  required: "Log in with Google to enter the Pevier control room.",
  "missing-config": "Google login is being configured. Please try again shortly.",
  denied: "Google sign-in was cancelled. Nothing was connected.",
  "invalid-state": "That sign-in attempt expired. Please start again.",
  "missing-code": "Google did not complete the sign-in. Please try again.",
  "connection-failed": "Google sign-in could not be completed. Please try again.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const authMessage = params.auth ? authMessages[params.auth] : undefined;

  return (
    <LandingMotion>
      <main className="public-home">
        <nav className="public-nav" aria-label="Public navigation">
          <Link className="legal-brand" href="/">
            <span><Shield size={18} weight="fill" /></span>
            <strong>PEVIER</strong>
            <small>POLICY FIREWALL</small>
          </Link>
          <Link className="public-nav__signin" href={user ? "/control-room" : "/api/auth/google/connect"}>
            {user ? "Open control room" : "Log in"}<ArrowRight size={16} />
          </Link>
        </nav>

        <section className="public-hero">
          <div className="public-hero__copy" data-enter>
            {authMessage && <div className="auth-notice" role="status"><Shield size={15} /><span>{authMessage}</span></div>}
            <p className="public-kicker"><span /> POLICY CONTROL FOR AUTONOMOUS PUBLISHERS</p>
            <h1>Publish only what passes policy.</h1>
            <p className="public-hero__lede">Pevier evaluates autonomous publishing requests, stops unsafe actions, and records evidence before Instagram or Bluesky receives anything.</p>
            <div className="public-hero__actions">
              {user ? (
                <Link className="button button--primary" href="/control-room"><Shield size={18} />Open control room</Link>
              ) : (
                <Link className="button button--primary google-auth-button" href="/api/auth/google/connect"><Image src="/google-mark.svg" alt="" width={18} height={18} />Continue with Google</Link>
              )}
              <Link className="button button--quiet" href="#how-it-works">See the workflow <ArrowRight size={17} /></Link>
            </div>
            <small><Check size={14} weight="bold" /> {user ? `Signed in as ${user.email}` : "Google creates the account. Pevier keeps every publisher connection separate."}</small>
          </div>

          <div className="public-decision" data-enter aria-label="Example Pevier policy decision">
            <header><span>REQUEST / 0147</span><span className="decision-live"><i />EVALUATING</span></header>
            <div className="decision-copy"><small>DESTINATION</small><strong>Instagram Reel</strong><span>@chisomelvin1</span></div>
            <dl>
              <div><dt>Disclosure</dt><dd><Check size={14} weight="bold" />Pass</dd></div>
              <div><dt>Duplication</dt><dd><Check size={14} weight="bold" />Pass</dd></div>
              <div><dt>Cadence</dt><dd><Check size={14} weight="bold" />Pass</dd></div>
            </dl>
            <footer><span>FINAL DECISION</span><strong>ALLOW</strong><small>Risk 09 / 100</small></footer>
            <div className="decision-hash"><Fingerprint size={15} /><code>PV-29322EED</code><span>Evidence sealed</span></div>
          </div>
        </section>

        <section className="public-workflow" id="how-it-works" aria-labelledby="workflow-title">
          <header>
            <p>THE ENFORCEMENT BOUNDARY</p>
            <h2 id="workflow-title">The agent can request. Pevier decides.</h2>
          </header>
          <p className="workflow-lede">A single path keeps credentials, policy decisions, platform writes, and evidence under one accountable control plane.</p>
          <div className="workflow-list">
            {workflow.map((item, index) => (
              <article key={item.title} data-workflow-stage>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <item.icon size={22} />
                <div><h3>{item.title}</h3><p>{item.copy}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="public-platforms" aria-labelledby="platform-title">
          <div><p>CONNECTED SURFACES</p><h2 id="platform-title">Two live adapters. One policy record.</h2></div>
          <div className="platform-ledger">
            <article><span className="platform-mark platform-mark--instagram">IG</span><div><strong>Instagram</strong><small>Business and Creator accounts</small></div><b>LIVE</b></article>
            <article><span className="platform-mark platform-mark--bluesky">BS</span><div><strong>Bluesky</strong><small>Personal accounts via OAuth</small></div><b>LIVE</b></article>
            <article className="is-upcoming"><YoutubeLogo size={19} /><div><strong>YouTube</strong><small>Adapter in development</small></div><b>SOON</b></article>
            <article className="is-upcoming"><span className="x-monogram" aria-hidden="true">X</span><div><strong>X</strong><small>Adapter in development</small></div><b>SOON</b></article>
          </div>
        </section>

        <footer className="public-footer">
          <h2>Let agents move fast.<br />Keep the final say.</h2>
          <div><span>Pevier / Policy Firewall</span><span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></span><small>Built for accountable autonomous publishing.</small></div>
        </footer>
      </main>
    </LandingMotion>
  );
}
