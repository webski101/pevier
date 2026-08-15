import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — Pevier",
  description: "Terms governing use of the Pevier policy firewall.",
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="SERVICE AGREEMENT" title="Terms of Service" updated="15 August 2026">
      <p className="legal-lede">These terms govern your use of Pevier. By signing in or using the service, you agree to them.</p>

      <section><h2>The service</h2><p>Pevier evaluates social-media publication requests against configured policies, records audit evidence, and, when permitted, sends content to connected platforms. Pevier is a control and risk-assistance tool; it does not replace human judgment or legal advice.</p></section>
      <section><h2>Your account and channels</h2><p>You must provide accurate information, protect your account, and connect only channels you are authorised to manage. You are responsible for activity initiated through your account and for reviewing publication decisions before relying on them.</p></section>
      <section><h2>Acceptable use</h2><p>You may not use Pevier to break laws, violate platform rules, impersonate others, distribute harmful or infringing content, bypass access controls, probe other users&apos; data, or interfere with the service. Automated use must remain within the policy and authentication boundaries Pevier provides.</p></section>
      <section><h2>Platform rules</h2><p>Your use of YouTube remains subject to YouTube&apos;s Terms of Service and Google&apos;s policies. Platform availability, quotas, reviews, and enforcement are controlled by those providers and may change independently of Pevier.</p></section>
      <section><h2>Content and permissions</h2><p>You keep ownership of content you submit. You grant Pevier only the limited permission needed to evaluate, transmit, and record information about that content as part of the service. You confirm that you have the rights necessary to upload it.</p></section>
      <section><h2>Availability and changes</h2><p>Pevier may be changed, suspended, or discontinued. Features may be experimental, and publication attempts may fail because of policy decisions, platform errors, quotas, or network conditions. Do not use Pevier as the sole copy of important content.</p></section>
      <section><h2>Disclaimers and liability</h2><p>The service is provided “as is” without warranties to the extent permitted by law. Pevier&apos;s operators are not liable for indirect, incidental, or consequential losses arising from use of the service. Nothing in these terms excludes liability that cannot legally be excluded.</p></section>
      <section><h2>Termination</h2><p>You may stop using Pevier at any time. We may restrict access for abuse, security risk, legal requirements, or violations of these terms. Provisions that naturally survive termination, including responsibility, disclaimers, and audit integrity, will continue.</p></section>
      <section><h2>Contact</h2><p>Questions about these terms can be sent to <a href="mailto:mmadubuikechisom1@gmail.com">mmadubuikechisom1@gmail.com</a>.</p></section>
    </LegalPage>
  );
}
