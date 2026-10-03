# CivicFix AI

A civic infrastructure reporting portfolio built by **Edzani Maisha**. Residents create confirmed reports with locations and photos; operations staff acknowledge, assign and resolve them. CivicFix is not an official municipal integration or emergency dispatcher.

## Implemented

- Responsive Next.js resident and operations experiences
- Supabase email registration, sign-in, sign-out and password recovery
- Manual reporting and conversational, validated AI drafts with human confirmation
- Rule-based drafting when an AI key is absent, explicitly labelled
- Address and OpenStreetMap location selection; validated, private photo evidence
- Real report creation, reference numbers, department routing, pagination and tracking
- Department-scoped staff queues, assignments to departments/personnel, status transitions
- Public updates, private staff notes, audited category/urgency corrections
- Operational counts, map, response targets, timing aggregates and safe CSV export
- Server-side ownership/role checks, private evidence access and duplicate-submission protection
- Isolated local demonstration with resident, staff, manager and administrator personas
- Backend integration tests, signed-token tests, browser journeys and application CI

Hosted Supabase email delivery, real AI calls and public hosting require external configuration. The local demo uses a separate SQLite database and rule-based drafts, never real municipal delivery.

## Try the complete local demo

Requirements: Python 3.12+ and Node.js 22+.

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
cd frontend
npm ci
cd ..
python scripts/run_demo.py
```

Open **http://localhost:3000/login**. Choose resident, submit a water-leak report, sign out, choose manager, acknowledge and assign it, then move it to in progress and resolved. Return as resident to verify the public updates. Staff and managers are scoped to Water and Sanitation in the demo. The administrator can review every department.

Drafts stay in tab session storage, separated by user. The demo database is `civicfix-demo.db`; restart preserves reports and generates new demo access tokens. Demo mode is refused unless the environment is explicitly `demo`, the database is SQLite and a strong demo signing secret is supplied. Never publish demo mode with real data.

## Run with Supabase

Follow [deployment setup](docs/deployment.md). Apply `database/schema.sql`, `database/seed.sql`, then `database/migration_004_workflows.sql` to a fresh Supabase database. Existing Phase 1 databases need the migration, not a reapplication of the original schema.

Copy `backend/.env.example` to `backend/.env`, and `frontend/.env.example` to `frontend/.env.local`. Supply your project configuration. The browser gets only the public publishable/anon key; the service key and AI key stay on the API server.

```bash
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000
# another terminal
cd frontend
npm run dev -- --hostname 127.0.0.1
```

## Validation

```bash
python scripts/validate_phase1.py
python -m unittest discover -s tests -v
# Bash: PYTHONPATH=backend pytest backend/tests -q
# PowerShell: $env:PYTHONPATH="backend"; pytest backend/tests -q
cd frontend
npm run lint
npm run typecheck
npm run build
# Start the demo in another terminal before the browser tests:
npx playwright install chromium
npm run test:e2e
```

CI also applies the Supabase-compatible schema and migrations to disposable PostgreSQL, checks profile provisioning, and exercises the ORM repository. Local PostgreSQL tests are skipped unless `TEST_DATABASE_URL` points to a disposable empty database. Never set it to a real project database.

## Structure

| Path | Purpose |
|---|---|
| `frontend/` | Next.js pages, forms, maps, API/auth clients, browser tests |
| `backend/app/` | FastAPI, JWT verification, permissions, workflow and AI adapter |
| `backend/tests/` | Domain, integration, provider, authentication and PostgreSQL checks |
| `database/` | Supabase schema, department/category seed and migration |
| `scripts/` | Local demo, validation and expired conversation cleanup |
| `docs/` | Product, architecture, API, AI, security and deployment documentation |

## Release status and limits

The code supports the complete portfolio reporting workflow. Live account verification, object storage and paid AI access must be tested against the configured accounts before a public release. There is no municipality dispatch integration. The initial AI adapter uses a compatible structured-output Chat Completions endpoint; provider outputs are validated and cannot call incident/workflow actions.

Rate limits are per API worker; multiple replicas need a shared gateway limiter. Photo re-encoding removes embedded metadata, but it does not automatically redact faces or number plates. Search and status filtering cover loaded pages; the UI offers pagination and says when older reports remain. Response targets are illustrative portfolio targets, not service commitments. Run expired-conversation cleanup daily. A demo video and real hosted-service smoke test remain release tasks.

## License

[MIT](LICENSE)
