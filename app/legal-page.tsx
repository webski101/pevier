import Link from "next/link";
import { Shield } from "lucide-react";
import type { ReactNode } from "react";

export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <main className="legal-shell">
      <nav className="legal-nav" aria-label="Legal page navigation">
        <Link className="legal-brand" href="/">
          <span><Shield size={18} /></span>
          <strong>PEVIER</strong>
        </Link>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link className="legal-nav__return" href="/">Return to Pevier</Link>
        </div>
      </nav>

      <article className="legal-document">
        <header>
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>Last updated {updated}</span>
        </header>
        <div className="legal-copy">{children}</div>
      </article>
    </main>
  );
}
