# Backend

FastAPI with SQLAlchemy async PostgreSQL and Supabase-compatible ES256/RS256 JWT verification. Configure from `backend/.env.example`; run from `backend/` so its environment file is loaded. See [deployment](deployment.md) for database migration, auth redirect and storage setup.

Local demonstration uses explicit demo mode, a separate SQLite database and seeded role personas. Production startup refuses demo mode or missing Supabase auth/private storage configuration.

Profiles are provisioned by the Supabase auth trigger, with a backend resident-only fallback. Roles are read from the database on each request. Every report, photo, activity, assignment, update and export checks ownership or department scope. Workflow changes lock report rows and write history/audit entries transactionally. Internal notes use a separate visibility field and are excluded from resident activity responses.

Tests include the complete API journey, input validation, duplicate submissions, pagination, private evidence, role checks, signed JWTs, provider response validation, owned draft sessions and privilege management. CI also applies the SQL schema/seed/migration to PostgreSQL and exercises repository operations there.

The API connects using trusted database credentials; browser incident writes are disabled by the migration. Do not expose these credentials to clients. Per-worker request limiting should be complemented by a shared limiter for replicated production deployments.
