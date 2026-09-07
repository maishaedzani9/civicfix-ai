from __future__ import annotations

import base64
import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Actor, Role
from app.domain.incidents import IncidentStatus, validate_transition
from app.models import Incident, IncidentStatusHistory
from app.schemas import IncidentCreate, StatusTransitionCreate


def make_reference() -> str:
    return f"CF-{datetime.now(UTC).year}-{secrets.token_hex(4).upper()}"


def encode_cursor(created_at: datetime, incident_id: UUID) -> str:
    raw = f"{created_at.isoformat()}|{incident_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        timestamp, identifier = base64.urlsafe_b64decode(padded).decode().split("|", 1)
        return datetime.fromisoformat(timestamp), UUID(identifier)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError("Invalid pagination cursor.") from exc


class IncidentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, actor: Actor, payload: IncidentCreate) -> Incident:
        incident = Incident(
            reference_number=make_reference(),
            reporter_id=actor.user_id,
            category_id=payload.category_id,
            title=payload.title,
            description=payload.description,
            urgency=payload.urgency,
            status=IncidentStatus.SUBMITTED,
            address_text=payload.address_text,
            latitude=payload.latitude,
            longitude=payload.longitude,
        )
        self.session.add(incident)
        await self.session.flush()
        self.session.add(
            IncidentStatusHistory(
                incident_id=incident.id,
                from_status=None,
                to_status=IncidentStatus.SUBMITTED,
                changed_by=actor.user_id,
                reason="Incident submitted.",
            )
        )
        await self.session.commit()
        await self.session.refresh(incident)
        return incident

    async def get_authorized(self, actor: Actor, incident_id: UUID, for_update: bool = False) -> Incident | None:
        statement = select(Incident).where(Incident.id == incident_id)
        if actor.role == Role.RESIDENT:
            statement = statement.where(Incident.reporter_id == actor.user_id)
        elif actor.role in {Role.STAFF, Role.MANAGER}:
            if actor.department_id is None:
                return None
            statement = statement.where(Incident.department_id == actor.department_id)
        if for_update:
            statement = statement.with_for_update()
        return await self.session.scalar(statement)

    async def list_authorized(
        self, actor: Actor, *, limit: int, cursor: str | None
    ) -> tuple[list[Incident], str | None]:
        statement = select(Incident)
        if actor.role == Role.RESIDENT:
            statement = statement.where(Incident.reporter_id == actor.user_id)
        elif actor.role in {Role.STAFF, Role.MANAGER}:
            if actor.department_id is None:
                return [], None
            statement = statement.where(Incident.department_id == actor.department_id)
        if cursor:
            created_at, incident_id = decode_cursor(cursor)
            statement = statement.where(
                or_(
                    Incident.created_at < created_at,
                    and_(Incident.created_at == created_at, Incident.id < incident_id),
                )
            )
        statement = statement.order_by(desc(Incident.created_at), desc(Incident.id)).limit(limit + 1)
        rows = list((await self.session.scalars(statement)).all())
        has_more = len(rows) > limit
        items = rows[:limit]
        next_cursor = encode_cursor(items[-1].created_at, items[-1].id) if has_more and items else None
        return items, next_cursor

    async def transition(
        self, actor: Actor, incident_id: UUID, payload: StatusTransitionCreate
    ) -> Incident | None:
        incident = await self.get_authorized(actor, incident_id, for_update=True)
        if incident is None:
            return None
        validate_transition(incident.status, payload.to_status)
        old_status = incident.status
        incident.status = payload.to_status
        incident.version += 1
        if payload.to_status == IncidentStatus.ACKNOWLEDGED:
            incident.acknowledged_at = datetime.now(UTC)
        elif payload.to_status == IncidentStatus.RESOLVED:
            incident.resolved_at = datetime.now(UTC)
        elif payload.to_status == IncidentStatus.CLOSED:
            incident.closed_at = datetime.now(UTC)
        self.session.add(
            IncidentStatusHistory(
                incident_id=incident.id,
                from_status=old_status,
                to_status=payload.to_status,
                changed_by=actor.user_id,
                reason=payload.public_message or payload.internal_note,
            )
        )
        await self.session.commit()
        await self.session.refresh(incident)
        return incident
