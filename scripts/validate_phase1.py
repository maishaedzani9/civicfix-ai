"""Validate the completeness and consistency of CivicFix AI Phase 1."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FILES = (
    "README.md",
    "docs/product-requirements.md",
    "docs/architecture.md",
    "docs/backend.md",
    "docs/api-contract.md",
    "docs/ai-contract.md",
    "docs/security.md",
    "database/schema.sql",
    "database/seed.sql",
    "tests/test_phase1_contracts.py",
    "CONTRIBUTING.md",
    "LICENSE",
    "backend/app/main.py",
    "backend/app/auth.py",
    "backend/app/repository.py",
    "backend/requirements.txt",
)


def fail(message: str) -> None:
    print(f"[FAIL] {message}")


def main() -> int:
    failures = 0
    for relative in REQUIRED_FILES:
        path = ROOT / relative
        if not path.is_file() or path.stat().st_size == 0:
            fail(f"missing or empty: {relative}")
            failures += 1
        else:
            print(f"[PASS] {relative}")

    schema_path = ROOT / "database/schema.sql"
    if schema_path.is_file():
        schema = schema_path.read_text(encoding="utf-8").lower()
        tables = set(re.findall(r"create table public\.([a-z_]+)", schema))
        required_tables = {
            "profiles", "departments", "categories", "incidents",
            "incident_evidence", "incident_assignments",
            "incident_status_history", "incident_updates",
            "triage_sessions", "triage_messages", "audit_logs",
        }
        missing = sorted(required_tables - tables)
        if missing:
            fail(f"missing schema tables: {', '.join(missing)}")
            failures += 1
        else:
            print(f"[PASS] {len(required_tables)} required tables")

        rls_tables = set(re.findall(r"alter table public\.([a-z_]+) enable row level security", schema))
        missing_rls = sorted(required_tables - rls_tables)
        if missing_rls:
            fail(f"RLS not enabled: {', '.join(missing_rls)}")
            failures += 1
        else:
            print("[PASS] RLS enabled on required tables")

    if failures:
        print(f"Phase 1 validation failed with {failures} problem(s).")
        return 1
    print("Phase 1 validation completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
