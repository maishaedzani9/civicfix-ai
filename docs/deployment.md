# Configure and deploy CivicFix AI

## 1. Supabase database and authentication

Create or restore a Supabase project. For a fresh project, execute these SQL files in order:

1. `database/schema.sql`
2. `database/seed.sql`
3. `database/migration_004_workflows.sql`

For an existing Phase 1 project, apply only the migration and rerun the idempotent seed if needed. The migration adds retry records, provisions new user profiles, backfills existing accounts and removes direct browser incident writes. New registrations always receive resident privileges.

Enable email/password authentication and configure the Site URL. Add these redirect URLs for each frontend origin:

- `https://YOUR_FRONTEND/dashboard`
- `https://YOUR_FRONTEND/reset-password`
- Local development equivalents at `http://localhost:3000`

Use Supabase's asymmetric signing keys (ES256/RS256). The backend verifies issuer, audience, expiry and signature through the project's JWKS endpoint. It reads authorisation roles from the database profile, not editable user metadata. Hosted legacy HS256 tokens are not supported by this release.

Create a **private** storage bucket named `incident-evidence`. Do not add browser/public read or write policies; the API uploads and retrieves photos after checking report ownership or department access.

## 2. Environment variables

### API server (`backend/.env.example`)

- `ENVIRONMENT=production`
- `DATABASE_URL`: privileged PostgreSQL connection URI using `postgresql+asyncpg://`; prefer a direct connection or session pooler, with TLS configured per your database provider
- `SUPABASE_JWT_ISSUER=https://PROJECT.supabase.co/auth/v1`
- `SUPABASE_JWKS_URL=https://PROJECT.supabase.co/auth/v1/.well-known/jwks.json`
- `SUPABASE_URL=https://PROJECT.supabase.co`
- `SUPABASE_SERVICE_KEY`: server-only service/secret key
- `EVIDENCE_BUCKET=incident-evidence`
- `CORS_ORIGINS=https://YOUR_FRONTEND` (comma-separated exact origins if needed)
- `DEMO_MODE=false`
- `AI_API_KEY`: optional server-only provider key
- `AI_BASE_URL=https://api.openai.com/v1` or a trusted compatible provider
- `AI_MODEL`: a model supporting the structured JSON schema used by the adapter

An empty AI key activates labelled basic drafting. A configured provider that fails returns an error so the resident can complete the form manually. The API refuses production startup if Supabase auth or private storage configuration is absent, or if demo mode is enabled.

### Frontend (build-time configuration)

- `NEXT_PUBLIC_API_URL=https://YOUR_API/api/v1`
- `NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public publishable/anon key
- `NEXT_PUBLIC_DEMO_MODE=false`

Rebuild the frontend after changing these values. Never put the database password, Supabase service key or AI key in a `NEXT_PUBLIC_` variable.

## 3. Hosting

Deploy `frontend/` as a Next.js application, for example with the existing Vercel project. Root directory: `frontend`; install command: `npm ci`; build: `npm run build`. The lockfile is committed.

Deploy `backend/` using its Dockerfile or a Python web service. Start `uvicorn app.main:app --host 0.0.0.0 --port 8000` (adapt the port to your host). Health checks: `/api/v1/health` and `/api/v1/health/ready`. Add the environment variables before starting the service. Production photos use Supabase Storage, so the container does not need a persistent upload volume.

Apply database changes separately before starting the API; startup never auto-migrates a hosted database. Keep database credentials restricted to the API. The frontend talks to the API and Supabase Auth, not directly to incident tables.

## 4. Promote staff accounts

After the person signs up, a trusted database administrator can promote the existing profile. Replace the identifiers before executing:

```sql
update public.profiles
set role = 'manager',
    department_id = (select id from public.departments where slug = 'water-and-sanitation')
where id = 'THE-AUTH-USER-UUID';
```

Staff and managers need a department. Administrators can access every department. The API checks current profile roles on each request, so changes take effect without trusting old role metadata in JWTs.

## 5. Release smoke test

Use two resident accounts plus one departmental staff/manager account:

- Register, confirm email, sign in, sign out, reset password, and sign in with the new password.
- Submit a manual report and an AI-assisted report; edit a suggestion and confirm it.
- Select a location and upload a photo; verify the private photo is available only to its owner and authorised staff.
- Retry the same report request and verify that it returns the same reference.
- Verify the second resident cannot access the first resident's report.
- Acknowledge, assign, post a public update and internal note, resolve, and close.
- Verify the resident sees the public update and cannot see the internal note.
- Verify other departments cannot access the report; test CSV and analytics as staff.
- Check health/readiness, server logs, and mobile layouts.

Run `python scripts/expire_triage.py` daily from an environment with the backend `.env` loaded (or equivalent secret environment variables). It removes expired conversations; confirmed sessions linked to reports retain their draft record while message content is removed. Set a shared request limiter at your gateway before running multiple API replicas.

The local tests mock provider responses and JWKS retrieval, and exercise real signatures; they cannot verify email delivery, your hosting or your live AI account. Record the hosted smoke-test results before calling the public deployment complete.
