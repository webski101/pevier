import Link from "next/link";
import { ArrowRight, Bot, Check, Fingerprint, Shield, SlidersHorizontal, Youtube } from "lucide-react";

const proof = [
  { icon: SlidersHorizontal, title: "Evaluate every request", copy: "Policy rules score metadata before any platform adapter can act." },
  { icon: Shield, title: "Stop unsafe publishing", copy: "ALLOW, HOLD, and BLOCK decisions enforce a clear boundary for autonomous agents." },
  { icon: Fingerprint, title: "Keep audit evidence", copy: "Tamper-evident records preserve each decision and state transition." },
];

export default function Home() {
  return (
    <main className="public-home">
      <nav className="public-nav" aria-label="Public navigation">
        <Link className="legal-brand" href="/"><span><Shield size={18} /></span><strong>Pevier</strong></Link>
        <div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link className="public-nav__signin" href="/api/platforms/youtube/connect">Sign in with Google</Link></div>
      </nav>

      <section className="public-hero">
        <div className="public-hero__copy">
          <p><span /> YOUTUBE POLICY FIREWALL</p>
          <h1>Control what autonomous publishers can post.</h1>
          <p className="public-hero__lede">Pevier is a policy firewall for autonomous social-media publishing. It evaluates every request, blocks unsafe actions, uploads approved YouTube videos privately, and preserves verifiable audit evidence.</p>
          <div className="public-hero__actions"><Link className="button button--primary" href="/api/platforms/youtube/connect"><Youtube size={18} />Sign in with Google</Link><Link className="button button--quiet" href="/control-room">Explore the control room <ArrowRight size={17} /></Link></div>
          <small><Check size={14} /> Your Google credentials remain separated from autonomous agents.</small>
        </div>

        <div className="public-gateway" aria-label="Pevier publishing enforcement flow">
          <div><Bot size={18} /><span>Autonomous agent<small>Requests publication</small></span></div><i><ArrowRight size={16} /></i>
          <div className="is-active"><Shield size={19} /><span>Pevier<small>Evaluates policy</small></span></div><i><ArrowRight size={16} /></i>
          <div><Youtube size={19} /><span>YouTube<small>Private upload only</small></span></div>
          <footer><span>ALLOW</span><span>HOLD</span><span>BLOCK</span></footer>
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
