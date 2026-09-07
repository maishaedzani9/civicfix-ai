import unittest

from app.domain.incidents import IncidentStatus, InvalidStatusTransition, validate_transition


class IncidentWorkflowTests(unittest.TestCase):
    def test_valid_forward_transition(self) -> None:
        validate_transition(IncidentStatus.SUBMITTED, IncidentStatus.ACKNOWLEDGED)

    def test_resolved_incident_can_be_reopened(self) -> None:
        validate_transition(IncidentStatus.RESOLVED, IncidentStatus.IN_PROGRESS)

    def test_status_cannot_be_skipped(self) -> None:
        with self.assertRaises(InvalidStatusTransition):
            validate_transition(IncidentStatus.SUBMITTED, IncidentStatus.RESOLVED)

    def test_closed_incident_is_terminal(self) -> None:
        with self.assertRaises(InvalidStatusTransition):
            validate_transition(IncidentStatus.CLOSED, IncidentStatus.IN_PROGRESS)


if __name__ == "__main__":
    unittest.main()
