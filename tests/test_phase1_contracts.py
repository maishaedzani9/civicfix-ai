from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class Phase1ContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = (ROOT / "database/schema.sql").read_text(encoding="utf-8").lower()
        cls.api = (ROOT / "docs/api-contract.md").read_text(encoding="utf-8")
        cls.ai = (ROOT / "docs/ai-contract.md").read_text(encoding="utf-8")
        cls.requirements = (ROOT / "docs/product-requirements.md").read_text(encoding="utf-8")

    def test_incident_statuses_match_documented_workflow(self) -> None:
        expected = {
            "submitted", "acknowledged", "assigned", "in_progress",
            "resolved", "closed", "rejected",
        }
        match = re.search(r"create type public\.incident_status as enum \((.*?)\);", self.schema, re.S)
        self.assertIsNotNone(match)
        actual = set(re.findall(r"'([a-z_]+)'", match.group(1)))
        self.assertEqual(expected, actual)

    def test_ai_contract_requires_human_confirmation(self) -> None:
        self.assertIn('"requires_human_confirmation": true', self.ai)
        self.assertIn("cannot create a final incident without", (ROOT / "docs/architecture.md").read_text(encoding="utf-8"))

    def test_api_documents_core_endpoints(self) -> None:
        for endpoint in (
            "GET /health", "POST /incidents", "GET /incidents",
            "POST /triage/sessions", "GET /analytics/summary",
        ):
            self.assertIn(endpoint, self.api)

    def test_required_tables_use_row_level_security(self) -> None:
        required = {
            "profiles", "incidents", "incident_evidence", "incident_assignments",
            "incident_status_history", "incident_updates", "triage_sessions",
            "triage_messages", "audit_logs",
        }
        protected = set(re.findall(r"alter table public\.([a-z_]+) enable row level security", self.schema))
        self.assertTrue(required.issubset(protected))

    def test_requirements_include_testable_acceptance_criteria(self) -> None:
        identifiers = set(re.findall(r"FR-\d{2}", self.requirements))
        self.assertGreaterEqual(len(identifiers), 10)


if __name__ == "__main__":
    unittest.main()
