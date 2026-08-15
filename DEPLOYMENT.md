# Pevier public release checklist

Pevier's application-level multi-user boundary is implemented: Google identity creates a server session, YouTube credentials are encrypted per user, and posts, policies, incidents, status, portfolio data, and audit chains are owner-scoped.

## Before public traffic

- Use a hosted PostgreSQL database. SQLite is for local development and is not safe for horizontally scaled or ephemeral hosting.
- Keep `GOOGLE_CLIENT_SECRET`, `PEVIER_ENCRYPTION_KEY`, `PEVIER_AGENT_KEY`, and database credentials in the host's encrypted environment settings. Never prefix them with `NEXT_PUBLIC_`.
- Generate a new production encryption key. Back it up securely; losing it makes stored refresh tokens unreadable.
- Set `GOOGLE_REDIRECT_URI` to `https://YOUR-DOMAIN/api/platforms/youtube/callback` and add the exact same URI in Google Cloud.
- Publish and verify the Google OAuth consent screen for `youtube.upload` and `youtube.readonly`. While the app is in Testing, only approved test users can sign in.
- Keep YouTube mode at `DRY_RUN` by default. Every user must explicitly enable `LIVE`, and uploads remain hard-coded as private.
- Set a strong `PEVIER_AGENT_KEY` before enabling the autonomous `POST /api/publish` endpoint outside localhost.
- Replace the browser-to-server 128 MB upload route with a policy-gated resumable upload session before deploying to a host with small function body limits.

## Release checks

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Confirm `.env`, local databases, build output, and generated logs are ignored before pushing:

```bash
git check-ignore .env prisma/dev.db .next
```

## Current boundary

This commit is ready for source control and local multi-user testing. It is not yet an open public service: hosted database provisioning, deployment, Google verification, and the serverless-safe video transfer are separate release steps.
