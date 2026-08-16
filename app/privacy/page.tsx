import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Pevier",
  description: "How Pevier handles account, connected-platform, policy, and audit data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="DATA PRACTICES" title="Privacy Policy" updated="16 August 2026">
      <p className="legal-lede">Pevier is a policy firewall for autonomous social-media publishing. This policy explains what data Pevier uses, why it is needed, and the choices available to you.</p>

      <section><h2>Information we collect</h2><p>When you sign in with Google, Pevier receives your verified email address, name, profile image, and Google account identifier. We request only basic identity scopes and do not request YouTube access. When you connect Instagram or Bluesky, Pevier receives the connected account identity, OAuth credentials, and content you explicitly submit for evaluation or publishing.</p></section>
      <section><h2>Google account data</h2><p>Pevier uses basic Google identity data only to create your account, sign you in, and keep users&apos; records separate. Pevier does not store a Google access token or use Google account data for advertising.</p></section>
      <section><h2>Instagram data</h2><p>Pevier uses the Instagram permissions you grant only to identify your Professional account and publish Reels that you explicitly confirm. Pevier does not sell Instagram data, use it for advertising, or allow unrelated users to access your account.</p></section>
      <section><h2>Bluesky data</h2><p>Pevier uses the AT Protocol OAuth permission you grant only to identify your account and publish posts that you explicitly confirm. Pevier stores the revocable OAuth session encrypted and never receives or stores your Bluesky password.</p></section>
      <section><h2>Policy and audit records</h2><p>We store publication requests, policy decisions, risk signals, incident records, and tamper-evident audit hashes so you can review what the firewall allowed or stopped. Each signed-in user&apos;s records and platform connection are separated from other users.</p></section>
      <section><h2>How credentials are protected</h2><p>OAuth access and refresh tokens are encrypted before storage. Browser sessions use hashed tokens. Pevier does not reveal connected-platform credentials to autonomous agents that submit publication requests.</p></section>
      <section><h2>Sharing and service providers</h2><p>Data is shared only as needed to operate Pevier: Google processes account sign-in; Meta processes Instagram connection and publication requests; the user&apos;s AT Protocol provider processes Bluesky authorization and posts; Vercel hosts the application and temporary Reel transfer; and Neon hosts the application database. We may disclose information if required by law or to protect Pevier and its users.</p></section>
      <section><h2>Retention and deletion</h2><p>We retain account, connection, and audit data while your account is active or as needed to provide and secure the service. Temporary Reel files are removed after the Meta handoff. To request deletion of your Pevier account and stored data, email <a href="mailto:mmadubuikechisom1@gmail.com">mmadubuikechisom1@gmail.com</a>.</p></section>
      <section><h2>Your choices</h2><p>You can decline platform permissions, disconnect Instagram or Bluesky in Pevier, or stop using the service at any time. Disconnecting prevents future platform actions but does not automatically remove audit evidence already stored for security and integrity purposes.</p></section>
      <section><h2>Security and changes</h2><p>We use reasonable technical safeguards, but no internet service can guarantee absolute security. Material changes to this policy will be posted on this page with a revised date.</p></section>
      <section><h2>Contact</h2><p>Questions or privacy requests can be sent to <a href="mailto:mmadubuikechisom1@gmail.com">mmadubuikechisom1@gmail.com</a>.</p></section>
    </LegalPage>
  );
}
