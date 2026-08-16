# Pevier

**The policy firewall for autonomous social media.**

Pevier sits between autonomous publishing agents and social platforms. Every request passes through a policy engine, deterministic risk calculation, scoped circuit breaker, and tamper-evident audit chain before a platform adapter can act.

```text
Agent → Pevier → Policy Engine → Circuit Breaker → Platform Adapter
```

## Current release

- Google account sign-up and login with basic identity scopes only
- Authenticated control room; signed-out visitors cannot access user data or platform settings
- Instagram Login for Business and Creator accounts
- Per-user encrypted Instagram access tokens
- Safe publication dry runs that send nothing to Meta
- Explicit-confirmation public Reel publishing
- Temporary Reel transfer through Vercel Blob with cleanup after Meta imports the file
- Portfolio policy enforcement and deterministic risk scoring
- Agent, channel, platform, and portfolio circuit states
- SHA-256 hash-chained audit evidence and tamper detection
- Decision traces, incident timelines, and account-scoped production agent keys
- YouTube and X are intentionally unavailable and shown as **Coming soon**

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), continue with Google, and then connect Instagram from Settings. Publishing starts in `DRY_RUN`; Meta receives nothing until the operator selects Live public, chooses a Reel, and confirms the public write.

The `predev` setup creates `.env` from `.env.example`, generates Prisma, prepares the local database, and seeds a new workspace when needed.

## Configure login and connect Instagram

Create a Google OAuth web client that requests only `openid`, `email`, and `profile`. Register `http://localhost:3000/api/auth/google/callback` as an authorised redirect URI. Then configure an Instagram API app with Instagram Login and set:

```env
GOOGLE_AUTH_CLIENT_ID=""
GOOGLE_AUTH_CLIENT_SECRET=""
GOOGLE_AUTH_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
INSTAGRAM_APP_ID=""
INSTAGRAM_APP_SECRET=""
INSTAGRAM_REDIRECT_URI="http://localhost:3000/api/platforms/instagram/callback"
PEVIER_ENCRYPTION_KEY=""
BLOB_READ_WRITE_TOKEN=""
```

Google sign-in creates the Pevier browser session and does not request YouTube permissions or store a Google access token. After login, each user can connect their own Instagram Business or Creator account; that Instagram connection remains separate and encrypted.

## Connect a production publishing agent

Create an account API key in **Settings → Publisher bridge**, store it in your agent's secret manager, and use the connected Instagram agent and channel IDs. The bundled CLI accepts real metadata:

```bash
npm run agent:publish -- "Post title" "Post content"
```

The agent submits metadata through `POST /api/publish`. Every request is owner-scoped, recorded, and policy evaluated. An agent key cannot read Instagram OAuth credentials or confirm a public Reel; media upload and public confirmation remain operator actions in Pevier.

## Active API

```text
GET        /api/auth/google/connect
GET        /api/auth/google/callback
POST       /api/auth/logout
GET/POST/DELETE /api/agent-credentials
POST       /api/publish
GET        /api/posts
GET/PATCH  /api/platforms/instagram
GET        /api/platforms/instagram/connect
GET        /api/platforms/instagram/callback
POST       /api/platforms/instagram/publish
POST       /api/platforms/instagram/upload
GET        /api/status
GET        /api/portfolio
GET        /api/incidents
GET        /api/audit
POST       /api/circuit-breaker
GET/PATCH  /api/policies
```

There are no active YouTube OAuth or upload endpoints in this release.

## Tests

```bash
npm test
npm run lint
npm run build
```

> Pevier provides automated policy enforcement assistance and risk signals. Final legal and platform-policy responsibility remains with the operator.
