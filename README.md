# Pevier

**The policy firewall for autonomous social media.**

Pevier sits between autonomous publishing agents and social platforms. Every request passes through a modular policy engine, deterministic risk calculation, a scoped circuit breaker, and a tamper-evident audit chain before any platform adapter can run.

```text
Agent → Pevier → Policy Engine → Circuit Breaker → Platform Adapter
```

## Why it exists

AI agents can generate and publish content faster than humans can supervise them. One badly configured workflow can create repetitive content, cross-channel duplication, disclosure failures, platform-policy violations, abnormal publishing bursts, and portfolio-wide risk.

Pevier contains the source without unnecessarily stopping the portfolio.

## Core features

- Portfolio-wide policy enforcement
- Deterministic cross-channel similarity detection
- Repetitive-template and publishing-cadence guards
- AI sensitive-persona and disclosure checks
- Agent, channel, platform, and portfolio circuit state
- Blast-radius containment
- SHA-256 hash-chained audit evidence and tamper detection
- Decision traces and incident timelines
- Real YouTube OAuth and private-video upload adapter
- Google-backed user sessions with per-user encrypted YouTube connections
- Per-user posts, policy overrides, incidents, and tamper-evident audit chains
- Instagram and mock adapter contracts that remain non-publishing
- Safe and incident demo scenarios
- Runtime policy threshold editing

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No API key or social credential is required. Publishing defaults to `DRY_RUN`; the UI never claims that mocked output reached a real platform.

The `predev` setup creates `.env` from `.env.example`, generates Prisma, creates the SQLite schema, and seeds a new workspace automatically. Run `npm run db:setup` whenever you want to reset the demo data.

## Connect YouTube for free

The YouTube adapter is optional. Pevier works without credentials and stays in `DRY_RUN` by default.

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **YouTube Data API v3**.
3. Configure the OAuth consent screen and add these scopes under **Data access**:

   ```text
   https://www.googleapis.com/auth/youtube.upload
   https://www.googleapis.com/auth/youtube.readonly
   ```

   Pevier also requests the standard `openid`, `email`, and `profile` identity scopes. The upload scope publishes private videos. The read-only scope lets Pevier display and bind audit evidence to the connected channel's real name and ID.
4. Create an OAuth client of type **Web application**.
5. Add this authorized redirect URI:

   ```text
   http://localhost:3000/api/platforms/youtube/callback
   ```

6. Add the client ID and secret to `.env`.
7. Generate the local token-encryption key shown in `.env.example` and add it to `.env`.
8. Start Pevier, open **Settings**, and select **Sign in with Google**. That one OAuth flow creates the Pevier session and connects the signed-in user's own YouTube channel. Existing local connections must reconnect once after upgrading to the multi-user build.

Connection does not enable publishing. After OAuth, Pevier remains in `DRY_RUN` until an operator explicitly selects **Live private**. Live uploads are hard-coded to YouTube visibility `private`; autonomous agents never receive the Google tokens.

The local upload pilot accepts video files up to 128 MB. This route is intended for local validation; a deployed version should use a direct resumable-upload handoff to avoid serverless request-size limits.

Instagram remains deferred and disabled in the product UI. The current public-product path is YouTube only.

## Run the free local publishing agent

Keep Pevier running in one terminal, then open a second terminal in the project folder. Send a safe autonomous request through the real gateway with:

```bash
npm run agent:demo -- safe
```

The agent selects the connected YouTube channel when its identity is available, submits metadata to `POST /api/publish`, and prints the live policy decision and audit ID. It never receives the Google OAuth tokens.

Test the free correction loop without uploading a file:

```bash
npm run agent:demo -- repair
```

This deliberately repeats a recent title. Pevier should return `HOLD` with a required action, after which the agent revises the title and retries once. Because the scenario sends metadata only, it cannot upload a YouTube video even when the connected adapter is live.

To prove containment without sending anything to YouTube:

```bash
npm run agent:demo -- blocked
```

That scenario intentionally triggers the synthetic financial-persona rule and creates `BLOCK` evidence. In local development the gateway accepts only loopback requests by default. Before exposing Pevier beyond localhost, set `PEVIER_AGENT_KEY` in `.env`; external agents must then send it as a Bearer token.

To send an explicitly approved video through the same firewall, first select **Live private** in Pevier Settings, then run:

```bash
npm run agent:demo -- private "C:\Videos\clip.mp4" "Video title"
```

This is the only agent demo command that includes video bytes. It requires both the operator-controlled Live private setting and the explicit `private` command. Pevier evaluates the metadata before handing the file to YouTube, and the adapter hard-codes visibility to `private`. A `HOLD` or `BLOCK` decision uploads nothing.

Gateway responses also include a structured `remediation` plan. The local agent may revise and retry once when a `HOLD` is caused only by the repetitive-title policy. All other holds and every block require operator action; the agent cannot claim that disclosure or human review occurred on its own. This correction loop is deterministic and uses no paid AI service.

## API

```text
POST /api/publish
GET  /api/platforms/youtube
PATCH /api/platforms/youtube
DELETE /api/platforms/youtube
POST /api/platforms/youtube/upload
GET  /api/status
GET  /api/portfolio
GET  /api/incidents
GET  /api/audit
POST /api/circuit-breaker
GET/PATCH /api/policies
```

Example:

```ts
const response = await fetch("/api/publish", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    agentId: "shorts-agent-03",
    channelId: "channel-07",
    platform: "youtube",
    title: "5 AI Tools You NEED in 2026",
    contentText: "A synthetic presenter discusses financial returns.",
    syntheticMedia: true,
    targetRegions: ["US", "EU"]
  })
});

const result = await response.json();
if (result.decision === "ALLOW") {
  // The configured adapter may continue.
}
```

## Demo sequence

1. Start on **Overview** with 12 channels, four agents, and the portfolio `RUNNING`.
2. Press **Run incident demo**. Similarity and risk climb across sequential gateway events.
3. Watch `shorts-agent-03` move to `HALTED` while seven channels stay operational.
4. Open **Audit Log** and press **Verify chain**.
5. Use **Simulate tampering**, then verify again to show the exact invalid record.
6. Open **Policies**, change the block threshold, and submit the next request to `/api/publish`.

## Tests

```bash
npm test
```

The suite covers clean/held/blocked policy outcomes, circuit transitions, blast-radius isolation, valid chains, modified records, and broken links.

## Persistence

SQLite and Prisma back the local workspace. OAuth tokens are encrypted before storage, sessions store only SHA-256 token hashes, and user-owned records are queried by user ID. `prisma/seed.ts` creates demo data for local presentation only.

## Public deployment status

The repository is production-build clean, but making it available to arbitrary users still requires external setup that cannot be completed from source code alone:

1. Provision a hosted PostgreSQL database and migrate the Prisma datasource from local SQLite.
2. Deploy the Next.js server and set production environment variables without committing `.env`.
3. Add the production HTTPS callback URL to the Google OAuth client.
4. Move the Google OAuth consent screen to production and complete Google's verification for the YouTube upload scope. Until Google approves it, only listed test users can connect.
5. Replace the current 128 MB server upload with a direct resumable handoff before relying on serverless hosting request limits.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the release checklist. Do not advertise the service as open to everyone until all five items are complete.

> Pevier provides automated policy enforcement assistance and risk signals. Final legal and platform-policy responsibility remains with the operator.

## Screenshots

- Control Room during circuit-breaker event — _capture from local build_
- Audit chain verification and tamper detection — _capture from local build_
