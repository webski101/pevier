import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Pevier",
  description: "How Pevier handles account, YouTube, policy, and audit data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="DATA PRACTICES" title="Privacy Policy" updated="15 August 2026">
      <p className="legal-lede">Pevier is a policy firewall for autonomous social-media publishing. This policy explains what data Pevier uses, why it is needed, and the choices available to you.</p>

      <section><h2>Information we collect</h2><p>When you sign in with Google, Pevier receives the basic account information Google shares with us, such as your name, email address, and profile identifier. When you connect YouTube, Pevier also receives OAuth credentials and channel information needed to act on the channel you select.</p></section>
      <section><h2>YouTube data</h2><p>Pevier uses the YouTube permissions you grant only to identify your channel and upload videos that you explicitly submit. Uploads are private by default. Pevier does not sell YouTube data, use it for advertising, or allow unrelated users to access your channel.</p></section>
      <section><h2>Policy and audit records</h2><p>We store publication requests, policy decisions, risk signals, incident records, and tamper-evident audit hashes so you can review what the firewall allowed or stopped. Each signed-in user&apos;s records and platform connection are separated from other users.</p></section>
      <section><h2>How credentials are protected</h2><p>OAuth access and refresh tokens are encrypted before storage. Browser sessions use hashed tokens. Pevier does not reveal connected-platform credentials to autonomous agents that submit publication requests.</p></section>
      <section><h2>Sharing and service providers</h2><p>Data is shared only as needed to operate Pevier: Google and YouTube process sign-in and publication requests; Vercel hosts the application; and Neon hosts the application database. We may disclose information if required by law or to protect the security of Pevier and its users.</p></section>
      <section><h2>Retention and deletion</h2><p>We retain account, connection, and audit data while your account is active or as needed to provide and secure the service. You may revoke Pevier&apos;s Google access from your Google Account permissions. To request deletion of your Pevier account and stored data, email <a href="mailto:mmadubuikechisom1@gmail.com">mmadubuikechisom1@gmail.com</a>.</p></section>
      <section><h2>Your choices</h2><p>You can decline Google permissions, disconnect access through Google, or stop using Pevier at any time. Revoking access prevents future YouTube actions but does not automatically remove audit evidence already stored for security and integrity purposes.</p></section>
      <section><h2>Security and changes</h2><p>We use reasonable technical safeguards, but no internet service can guarantee absolute security. Material changes to this policy will be posted on this page with a revised date.</p></section>
      <section><h2>Contact</h2><p>Questions or privacy requests can be sent to <a href="mailto:mmadubuikechisom1@gmail.com">mmadubuikechisom1@gmail.com</a>.</p></section>
    </LegalPage>
  );
}
