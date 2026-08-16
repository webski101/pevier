# Pevier public release checklist

Pevier uses Google basic identity sign-in as its user boundary. Instagram is connected only after login; its tokens are encrypted per user, and posts, policies, incidents, status, portfolio data, and audit chains are owner-scoped.

## Before public traffic

- Use hosted PostgreSQL and apply the Prisma schema.
- Store `GOOGLE_AUTH_CLIENT_SECRET`, `INSTAGRAM_APP_SECRET`, `PEVIER_ENCRYPTION_KEY`, `PEVIER_AGENT_KEY`, `BLOB_READ_WRITE_TOKEN`, and database credentials only in encrypted host settings.
- Create a dedicated Google OAuth web client with only `openid`, `email`, and `profile`; set `GOOGLE_AUTH_REDIRECT_URI` to `https://YOUR-DOMAIN/api/auth/google/callback` and register the exact URI in Google Cloud.
- Register and verify the production homepage domain in Google Search Console if Google requests brand verification. YouTube scopes are not required.
- Set `INSTAGRAM_REDIRECT_URI` to `https://YOUR-DOMAIN/api/platforms/instagram/callback` and register that exact URI in Meta.
- Complete any Meta access review required for Professional accounts outside the app roles.
- Keep Instagram in `DRY_RUN` by default. Every live Reel requires explicit public confirmation.
- Set a strong `PEVIER_AGENT_KEY` before exposing `POST /api/publish` beyond localhost.
- Confirm temporary Reel files are deleted after Meta imports them.

## Release checks

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Confirm secrets, local databases, build output, and logs are ignored before pushing:

```bash
git check-ignore .env prisma/dev.db .next
```

YouTube and X are not part of the current release. No OAuth or publishing routes are exposed for either platform, and the interface labels both adapters **Coming soon**.
