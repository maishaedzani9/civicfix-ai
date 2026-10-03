# CivicFix frontend

Next.js/React/TypeScript resident reporting and operations dashboard. See the root README for the one-command local demonstration and `docs/deployment.md` for hosted configuration.

```bash
npm ci
npm run dev -- --hostname 127.0.0.1
npm run lint
npm run typecheck
npm run build
```

Use `.env.example` for build-time public configuration. Supabase handles email/password auth, session refresh and recovery. The API receives the access token and authorises every operation; browser controls are only presentation. All data screens load the API; there are no hard-coded report references or fake success responses.

Browser tests require the isolated demo running at port 3000 and API port 8000:

```bash
npx playwright install chromium
npm run test:e2e
```

The local demo login deliberately offers role personas and never connects to a real municipality or production database. Disable demo mode for hosted deployment.
