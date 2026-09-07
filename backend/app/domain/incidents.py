from enum import StrEnum


class IncidentStatus(StrEnum):
    SUBMITTED = "submitted"
    ACKNOWLEDGED = "acknowledged"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"
    REJECTED = "rejected"


class UrgencyLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


ALLOWED_TRANSITIONS: dict[IncidentStatus, frozenset[IncidentStatus]] = {
    IncidentStatus.SUBMITTED: frozenset({IncidentStatus.ACKNOWLEDGED, IncidentStatus.REJECTED}),
    IncidentStatus.ACKNOWLEDGED: frozenset({IncidentStatus.ASSIGNED, IncidentStatus.REJECTED}),
    IncidentStatus.ASSIGNED: frozenset({IncidentStatus.IN_PROGRESS}),
    IncidentStatus.IN_PROGRESS: frozenset({IncidentStatus.RESOLVED}),
    IncidentStatus.RESOLVED: frozenset({IncidentStatus.CLOSED, IncidentStatus.IN_PROGRESS}),
    IncidentStatus.CLOSED: frozenset(),
    IncidentStatus.REJECTED: frozenset(),
}


class InvalidStatusTransition(ValueError):
    pass


def validate_transition(current: IncidentStatus, target: IncidentStatus) -> None:
    if target not in ALLOWED_TRANSITIONS[current]:
        raise InvalidStatusTransition(f"Cannot transition incident from {current} to {target}.")
