from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Actor, Role, get_actor
from app.db import check_database, get_session
from app.domain.incidents import InvalidStatusTransition
from app.repository import IncidentRepository
from app.schemas import IncidentCreate, IncidentPage, IncidentRead, StatusTransitionCreate


router = APIRouter(prefix="/api/v1")


@router.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "civicfix-api"}


@router.get("/health/ready", tags=["system"])
async def readiness() -> dict[str, str]:
    try:
        await check_database()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable.") from exc
    return {"status": "ready", "database": "available"}


@router.post("/incidents", response_model=IncidentRead, status_code=status.HTTP_201_CREATED, tags=["incidents"])
async def create_incident(
    payload: IncidentCreate,
    actor: Actor = Depends(get_actor),
    session: AsyncSession = Depends(get_session),
) -> IncidentRead:
    incident = await IncidentRepository(session).create(actor, payload)
    return IncidentRead.model_validate(incident)


@router.get("/incidents", response_model=IncidentPage, tags=["incidents"])
async def list_incidents(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = None,
    actor: Actor = Depends(get_actor),
    session: AsyncSession = Depends(get_session),
) -> IncidentPage:
    try:
        items, next_cursor = await IncidentRepository(session).list_authorized(actor, limit=limit, cursor=cursor)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return IncidentPage(items=[IncidentRead.model_validate(item) for item in items], next_cursor=next_cursor)


@router.get("/incidents/{incident_id}", response_model=IncidentRead, tags=["incidents"])
async def get_incident(
    incident_id: UUID,
    actor: Actor = Depends(get_actor),
    session: AsyncSession = Depends(get_session),
) -> IncidentRead:
    incident = await IncidentRepository(session).get_authorized(actor, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found.")
    return IncidentRead.model_validate(incident)


@router.post("/incidents/{incident_id}/status-transitions", response_model=IncidentRead, tags=["workflow"])
async def transition_incident(
    incident_id: UUID,
    payload: StatusTransitionCreate,
    actor: Actor = Depends(get_actor),
    session: AsyncSession = Depends(get_session),
) -> IncidentRead:
    if actor.role == Role.RESIDENT:
        raise HTTPException(status_code=403, detail="Staff access required.")
    try:
        incident = await IncidentRepository(session).transition(actor, incident_id, payload)
    except InvalidStatusTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found.")
    return IncidentRead.model_validate(incident)
