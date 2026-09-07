# Backend Setup

## Local environment

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Linux or macOS:

```bash
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
```

Start PostgreSQL from the repository root:

```bash
docker compose up -d database
```

Apply `database/schema.sql` and `database/seed.sql` using the Supabase SQL editor or a PostgreSQL client. For local PostgreSQL:

```bash
psql postgresql://civicfix:civicfix@localhost:5432/civicfix -f database/schema.sql
psql postgresql://civicfix:civicfix@localhost:5432/civicfix -f database/seed.sql
```

The Phase 1 schema references `auth.users`, which Supabase supplies. When using standalone PostgreSQL, create an equivalent development `auth.users` table first or use Supabase locally.

## Authentication configuration

Replace the placeholder Supabase values in `backend/.env`. The backend validates JWT signatures against the project's JWKS endpoint and checks issuer and audience. Never place the Supabase service-role key in the browser or commit it.

Roles and optional department IDs are read from trusted `app_metadata` claims:

```json
{
  "app_metadata": {
    "role": "staff",
    "department_id": "53b7cc5c-9b02-43f6-83dc-1a44602fa747"
  }
}
```

User-editable metadata must not grant roles.

## Start the API

From `backend/`:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open:

- API documentation: `http://127.0.0.1:8000/docs`
- Liveness: `http://127.0.0.1:8000/api/v1/health`
- Database readiness: `http://127.0.0.1:8000/api/v1/health/ready`

## Tests

```bash
PYTHONPATH=backend python -m unittest discover -s backend/tests -v
python -m compileall backend/app backend/tests
```

The next backend increment will add disposable-database integration tests for SQL queries and authenticated endpoints.

## Security notes

- The liveness endpoint intentionally avoids a database call.
- The readiness endpoint reports availability without returning connection information.
- Resident queries are restricted by reporter ID.
- Staff and manager queries are restricted by department; missing department scope returns no incidents.
- Administrators can operate across departments.
- Status updates lock the incident row and write history in the same transaction.
- AI integration remains outside the incident service until structured-output validation is implemented.
