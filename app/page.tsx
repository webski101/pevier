import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bot, Check, Fingerprint, Instagram, Shield, SlidersHorizontal, Youtube } from "lucide-react";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const proof = [
  { icon: SlidersHorizontal, title: "Evaluate every request", copy: "Policy rules score metadata before any platform adapter can act." },
  { icon: Shield, title: "Stop unsafe publishing", copy: "ALLOW, HOLD, and BLOCK decisions enforce a clear boundary for autonomous agents." },
  { icon: Fingerprint, title: "Keep audit evidence", copy: "Tamper-evident records preserve each decision and state transition." },
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
    <main className="public-home">
      <nav className="public-nav" aria-label="Public navigation">
        <Link className="legal-brand" href="/"><span><Shield size={18} /></span><strong>Pevier</strong></Link>
        <div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link className="public-nav__signin" href={user ? "/control-room" : "/api/auth/google/connect"}>{user ? "Open Pevier" : "Log in"}</Link></div>
      </nav>

      <section className="public-hero">
        <div className="public-hero__copy">
          {authMessage && <div className="auth-notice" role="status"><Shield size={15} /><span>{authMessage}</span></div>}
          <p><span /> AUTONOMOUS PUBLISHING FIREWALL</p>
          <h1>Control what autonomous publishers can post.</h1>
          <p className="public-hero__lede">Pevier evaluates every autonomous publication request, blocks unsafe actions, publishes approved Instagram Reels, and preserves verifiable audit evidence.</p>
          <div className="public-hero__actions">{user ? <Link className="button button--primary" href="/control-room"><Shield size={18} />Open control room</Link> : <Link className="button button--primary google-auth-button" href="/api/auth/google/connect"><Image src="/google-mark.svg" alt="" width={18} height={18} />Continue with Google</Link>}<Link className="button button--quiet" href="#how-it-works">See how it works <ArrowRight size={17} /></Link></div>
          <small><Check size={14} /> {user ? `Signed in as ${user.email}` : "New here? Google creates your Pevier account automatically. No YouTube access requested."}</small>
        </div>

        <div className="public-adapters">
          <div className="public-gateway" aria-label="Pevier publishing enforcement flow">
            <div><Bot size={18} /><span>Autonomous agent<small>Requests publication</small></span></div><i><ArrowRight size={16} /></i>
            <div className="is-active"><Shield size={19} /><span>Pevier<small>Evaluates policy</small></span></div><i><ArrowRight size={16} /></i>
            <div><Instagram size={19} /><span>Instagram<small>Confirmed Reel publishing</small></span></div>
            <footer><span>ALLOW</span><span>HOLD</span><span>BLOCK</span></footer>
          </div>
          <div className="public-roadmap" aria-label="Upcoming platform adapters">
            <div className="public-coming-soon"><Youtube size={16} /><span>YouTube</span><small>Coming soon</small></div>
            <div className="public-coming-soon"><b className="x-monogram" aria-hidden="true">X</b><span>X (Twitter)</span><small>Coming soon</small></div>
          </div>
        </div>
      </section>

      <section className="public-proof" aria-labelledby="how-it-works">
        <header><p>POLICY BEFORE PUBLICATION</p><h2 id="how-it-works">One enforcement boundary. Three guarantees.</h2></header>
        <div>{proof.map((item) => <article key={item.title}><item.icon size={20} /><h3>{item.title}</h3><p>{item.copy}</p></article>)}</div>
      </section>

      <footer className="public-footer"><span>Pevier · Autonomous Publishing Firewall</span><span><Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Service</Link></span></footer>
    </main>
  );
}
