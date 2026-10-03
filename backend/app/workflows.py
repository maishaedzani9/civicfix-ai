import csv
import hashlib
import io
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Actor, Role, demo_token, get_actor
from app.config import Settings, get_settings
from app.db import get_session
from app.domain.incidents import IncidentStatus
from app.models import (AuditLog, Category, Department, IncidentAssignment, IncidentEvidence, IncidentStatusHistory,
                        IncidentUpdate, Profile, TriageSession, TriageMessage)
from app.repository import IncidentRepository
from app.schemas import AssignmentCreate, CorrectionCreate, IncidentRead, TriageCreate, UpdateCreate
from app.triage import prepare_draft
from app.limits import limit

router = APIRouter(prefix="/api/v1")


def staff(actor: Actor):
    if actor.role == Role.RESIDENT:
        raise HTTPException(403, "Staff access required.")


async def incident_for(actor, incident_id, session, lock=False):
    incident = await IncidentRepository(session).get_authorized(actor, incident_id, for_update=lock)
    if incident is None:
        raise HTTPException(404, "Incident not found.")
    return incident


@router.get("/me")
async def me(actor: Actor = Depends(get_actor)):
    return {"id": str(actor.user_id), "role": actor.role, "display_name": actor.display_name,
            "department_id": str(actor.department_id) if actor.department_id else None}


@router.post("/demo/login")
async def demo_login(persona: str = "resident", settings: Settings = Depends(get_settings),
                     session: AsyncSession = Depends(get_session)):
    if not settings.demo_mode or settings.environment != "demo":
        raise HTTPException(404, "Not found.")
    from app.demo import DEMO_USERS
    if persona not in DEMO_USERS:
        raise HTTPException(400, "Unknown demonstration persona.")
    return {"access_token": demo_token(DEMO_USERS[persona], settings)}


@router.get("/categories")
async def categories(session: AsyncSession = Depends(get_session)):
    rows = (await session.scalars(select(Category).where(Category.is_active.is_(True)).order_by(Category.name))).all()
    return [{"id": str(c.id), "name": c.name, "slug": c.slug} for c in rows]


@router.get("/departments")
async def departments(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    staff(actor)
    rows = (await session.scalars(select(Department).where(Department.is_active.is_(True)))).all()
    return [{"id": str(d.id), "name": d.name} for d in rows]


@router.get("/incidents/{incident_id}/activity")
async def activity(incident_id: UUID, actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    await incident_for(actor, incident_id, session)
    query = select(IncidentUpdate).where(IncidentUpdate.incident_id == incident_id)
    if actor.role == Role.RESIDENT:
        query = query.where(IncidentUpdate.visibility == "public")
    updates = (await session.scalars(query.order_by(IncidentUpdate.created_at))).all()
    history = (await session.scalars(select(IncidentStatusHistory).where(
        IncidentStatusHistory.incident_id == incident_id).order_by(IncidentStatusHistory.created_at))).all()
    evidence = (await session.scalars(select(IncidentEvidence).where(IncidentEvidence.incident_id == incident_id))).all()
    return {"updates": [{"id": str(u.id), "body": u.body, "visibility": u.visibility, "created_at": u.created_at.replace(tzinfo=UTC) if u.created_at.tzinfo is None else u.created_at} for u in updates],
            "history": [{"status": h.to_status, "created_at": h.created_at.replace(tzinfo=UTC) if h.created_at.tzinfo is None else h.created_at} for h in history],
            "evidence": [{"id": str(e.id), "media_type": e.media_type, "size_bytes": e.size_bytes} for e in evidence]}


@router.post("/incidents/{incident_id}/updates", status_code=201)
async def add_update(incident_id: UUID, payload: UpdateCreate, actor: Actor = Depends(get_actor),
                     session: AsyncSession = Depends(get_session)):
    staff(actor)
    await incident_for(actor, incident_id, session)
    update = IncidentUpdate(incident_id=incident_id, author_id=actor.user_id, **payload.model_dump())
    session.add(update)
    session.add(AuditLog(actor_id=actor.user_id, action="incident.update", entity_type="incident", entity_id=str(incident_id), event_metadata={"visibility": payload.visibility}))
    await session.commit()
    return {"id": str(update.id)}


@router.post("/incidents/{incident_id}/assignments", response_model=IncidentRead)
async def assign(incident_id: UUID, payload: AssignmentCreate, actor: Actor = Depends(get_actor),
                 session: AsyncSession = Depends(get_session)):
    if actor.role not in {Role.MANAGER, Role.ADMIN}:
        raise HTTPException(403, "Manager access required.")
    incident = await incident_for(actor, incident_id, session, True)
    if actor.role == Role.MANAGER and payload.department_id != actor.department_id:
        raise HTTPException(403, "Only administrators can route to another department.")
    department = await session.get(Department, payload.department_id)
    if department is None or not department.is_active:
        raise HTTPException(422, "Select an active department.")
    if payload.assignee_id:
        profile = await session.get(Profile, payload.assignee_id)
        if not profile or profile.role == "resident" or profile.department_id != payload.department_id:
            raise HTTPException(422, "Assignee must belong to the selected department.")
    if incident.status not in {IncidentStatus.ACKNOWLEDGED, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS}:
        raise HTTPException(409, "Acknowledge this report before assigning it.")
    existing = (await session.scalars(select(IncidentAssignment).where(
        IncidentAssignment.incident_id == incident_id, IncidentAssignment.unassigned_at.is_(None)))).all()
    for item in existing:
        item.unassigned_at = datetime.now(UTC)
    await session.flush()
    session.add(IncidentAssignment(incident_id=incident_id, department_id=payload.department_id,
                                  assignee_id=payload.assignee_id, assigned_by=actor.user_id))
    session.add(AuditLog(actor_id=actor.user_id, action="incident.assign", entity_type="incident", entity_id=str(incident_id), event_metadata={"department_id": str(payload.department_id), "assignee_id": str(payload.assignee_id) if payload.assignee_id else None}))
    incident.department_id = payload.department_id
    incident.version += 1
    if incident.status == IncidentStatus.ACKNOWLEDGED:
        incident.status = IncidentStatus.ASSIGNED
        session.add(IncidentStatusHistory(incident_id=incident_id, from_status=IncidentStatus.ACKNOWLEDGED,
                                         to_status=IncidentStatus.ASSIGNED, changed_by=actor.user_id))
    session.add(IncidentUpdate(incident_id=incident_id, author_id=actor.user_id, visibility="public",
                              body=f"Assigned to {department.name}."))
    await session.commit()
    await session.refresh(incident)
    return incident


@router.patch("/incidents/{incident_id}", response_model=IncidentRead)
async def correct(incident_id: UUID, payload: CorrectionCreate, actor: Actor = Depends(get_actor),
                  session: AsyncSession = Depends(get_session)):
    staff(actor)
    incident = await incident_for(actor, incident_id, session, True)
    if incident.version != payload.version:
        raise HTTPException(409, "Report changed. Refresh before saving.")
    category = await session.get(Category, payload.category_id)
    if not category or not category.is_active:
        raise HTTPException(422, "Select an active category.")
    session.add(AuditLog(actor_id=actor.user_id, action="incident.correct", entity_type="incident", entity_id=str(incident_id), event_metadata={"old_category": str(incident.category_id), "old_urgency": incident.urgency.value, "category_id": str(payload.category_id), "urgency": payload.urgency.value, "reason": payload.reason}))
    incident.category_id, incident.urgency = payload.category_id, payload.urgency
    incident.version += 1
    session.add(IncidentUpdate(incident_id=incident_id, author_id=actor.user_id, visibility="internal",
                              body=f"Category/urgency corrected: {payload.reason}"))
    await session.commit()
    await session.refresh(incident)
    return incident


@router.get("/analytics/summary")
async def analytics(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    staff(actor)
    from app.models import Incident
    query = select(Incident)
    if actor.role != Role.ADMIN:
        query = query.where(Incident.department_id == actor.department_id) if actor.department_id else query.where(False)
    rows = (await session.scalars(query)).all()
    now = datetime.now(UTC)
    resolved_times = [(i.resolved_at.replace(tzinfo=UTC) - i.created_at.replace(tzinfo=UTC)).total_seconds() / 3600 for i in rows if i.resolved_at]
    acknowledged_times = [(i.acknowledged_at.replace(tzinfo=UTC) - i.created_at.replace(tzinfo=UTC)).total_seconds() / 3600 for i in rows if i.acknowledged_at]
    import statistics
    return {"median_resolution_hours": statistics.median(resolved_times) if resolved_times else None,
            "median_acknowledgement_hours": statistics.median(acknowledged_times) if acknowledged_times else None,
            "by_category": {str(c): sum(i.category_id == c for i in rows) for c in {i.category_id for i in rows}},
            "by_department": {str(d): sum(i.department_id == d for i in rows) for d in {i.department_id for i in rows}},
            "by_date": {str(d): sum(i.created_at.date() == d for i in rows) for d in {i.created_at.date() for i in rows}},
            "total": len(rows), "by_status": {s.value: sum(i.status == s for i in rows) for s in IncidentStatus},
            "overdue": sum(i.status not in {IncidentStatus.CLOSED, IncidentStatus.RESOLVED, IncidentStatus.REJECTED}
                and (now - i.created_at.replace(tzinfo=UTC)).total_seconds() > (86400 if i.urgency in {"high", "critical"} else 259200) for i in rows)}


@router.get("/exports/incidents.csv")
async def export(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    staff(actor)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Reference", "Title", "Status", "Urgency", "Location", "Created"])
    cursor = None
    while True:
        items, cursor = await IncidentRepository(session).list_authorized(actor, limit=100, cursor=cursor)
        for i in items:
            # Prevent spreadsheet formula execution in user-authored cells.
            row = [i.reference_number, i.title, i.status.value, i.urgency.value, i.address_text or "", i.created_at.isoformat()]
            writer.writerow(["'" + v if v.lstrip().startswith(("=", "+", "-", "@")) else v for v in row])
        if not cursor:
            break
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="civicfix-reports.csv"'})


@router.post("/triage/draft")
async def triage(payload: TriageCreate, actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session),
                 settings: Settings = Depends(get_settings)):
    limit(actor.user_id, "triage", 30)
    categories = list((await session.scalars(select(Category.slug).where(Category.is_active.is_(True)))).all())
    return await prepare_draft(payload.message, categories, settings)


@router.post("/incidents/{incident_id}/evidence", status_code=201)
async def upload(incident_id: UUID, file: UploadFile = File(...), actor: Actor = Depends(get_actor),
                 session: AsyncSession = Depends(get_session), settings: Settings = Depends(get_settings)):
    limit(actor.user_id, "photos", 30)
    await incident_for(actor, incident_id, session, True)
    count = len((await session.scalars(select(IncidentEvidence.id).where(IncidentEvidence.incident_id == incident_id))).all())
    if count >= 5:
        raise HTTPException(422, "Maximum five photos per report.")
    raw = await file.read(10485761)
    if not raw or len(raw) > 10485760:
        raise HTTPException(413, "Photo must be between 1 byte and 10 MB.")
    try:
        with Image.open(io.BytesIO(raw)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"} or image.width * image.height > 20000000:
                raise ValueError("Unsupported photo")
            image.load()
            # Re-encode to remove EXIF/GPS and reject disguised non-image files.
            clean = io.BytesIO()
            image.convert("RGB").save(clean, format="JPEG", quality=88)
            content = clean.getvalue()
            if len(content) > 10485760:
                raise ValueError("Photo too large")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(422, "Use a valid JPEG, PNG or WebP photo under 20 megapixels.") from exc
    storage_path = f"{actor.user_id}/{incident_id}/{uuid4()}.jpg"
    if settings.supabase_service_key and settings.supabase_url:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(f"{settings.supabase_url}/storage/v1/object/{settings.evidence_bucket}/{storage_path}",
                headers={"Authorization": f"Bearer {settings.supabase_service_key}", "apikey": settings.supabase_service_key,
                         "Content-Type": "image/jpeg"}, content=content)
            if response.status_code >= 400:
                raise HTTPException(502, "Photo storage is unavailable. Your report is saved; retry the photo later.")
    else:
        path = Path(settings.evidence_directory) / storage_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    evidence = IncidentEvidence(incident_id=incident_id, uploaded_by=actor.user_id, storage_path=storage_path,
                                media_type="image/jpeg", size_bytes=len(content), sha256=hashlib.sha256(content).hexdigest())
    session.add(evidence)
    await session.commit()
    return {"id": str(evidence.id)}


@router.get("/incidents/{incident_id}/evidence/{evidence_id}")
async def photo(incident_id: UUID, evidence_id: UUID, actor: Actor = Depends(get_actor),
                session: AsyncSession = Depends(get_session), settings: Settings = Depends(get_settings)):
    await incident_for(actor, incident_id, session)
    evidence = await session.get(IncidentEvidence, evidence_id)
    if not evidence or evidence.incident_id != incident_id:
        raise HTTPException(404, "Photo not found.")
    if settings.supabase_service_key and settings.supabase_url:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{settings.supabase_url}/storage/v1/object/authenticated/{settings.evidence_bucket}/{evidence.storage_path}",
                headers={"Authorization": f"Bearer {settings.supabase_service_key}", "apikey": settings.supabase_service_key})
            if response.status_code != 200:
                raise HTTPException(502, "Photo storage is unavailable.")
            content = response.content
    else:
        path = Path(settings.evidence_directory) / evidence.storage_path
        if not path.is_file():
            raise HTTPException(404, "Photo unavailable.")
        content = path.read_bytes()
    return Response(content, media_type="image/jpeg", headers={"Cache-Control": "private, no-store"})


@router.get("/personnel")
async def personnel(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    if actor.role not in {Role.MANAGER, Role.ADMIN}:
        raise HTTPException(403, "Manager access required.")
    query = select(Profile).where(Profile.role != "resident")
    if actor.role == Role.MANAGER:
        query = query.where(Profile.department_id == actor.department_id) if actor.department_id else query.where(False)
    rows = (await session.scalars(query)).all()
    return [{"id": str(p.id), "name": p.display_name, "department_id": str(p.department_id) if p.department_id else None} for p in rows]


@router.get("/audit")
async def audit(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    if actor.role != Role.ADMIN:
        raise HTTPException(403, "Administrator access required.")
    rows = (await session.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(100))).all()
    return [{"action": row.action, "entity_id": row.entity_id, "actor_id": str(row.actor_id), "created_at": row.created_at, "metadata": row.event_metadata} for row in rows]


async def owned_triage(session_id, actor, session):
    value = await session.get(TriageSession, session_id)
    if value is None or value.owner_id != actor.user_id:
        raise HTTPException(404, "Draft session not found.")
    if value.expires_at.replace(tzinfo=UTC) <= datetime.now(UTC):
        raise HTTPException(410, "Draft session expired. Start a new draft.")
    return value


@router.post("/triage/sessions", status_code=201)
async def new_triage(actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    limit(actor.user_id, "sessions", 30)
    value = TriageSession(owner_id=actor.user_id, expires_at=datetime.now(UTC) + timedelta(hours=24))
    session.add(value)
    await session.commit()
    return {"id": str(value.id), "expires_at": value.expires_at}


@router.post("/triage/sessions/{session_id}/messages")
async def triage_message(session_id: UUID, payload: TriageCreate, actor: Actor = Depends(get_actor),
                         session: AsyncSession = Depends(get_session), settings: Settings = Depends(get_settings)):
    value = await owned_triage(session_id, actor, session)
    limit(actor.user_id, "triage", 30)
    messages = (await session.scalars(select(TriageMessage).where(TriageMessage.session_id == session_id,
        TriageMessage.role == "user").order_by(TriageMessage.created_at))).all()
    if len(messages) >= 10:
        raise HTTPException(422, "Start a new draft after ten messages.")
    categories = list((await session.scalars(select(Category.slug).where(Category.is_active.is_(True)))).all())
    content = "\n".join([message.content for message in messages] + [payload.message])
    if len(content) > 4000:
        raise HTTPException(422, "Draft conversation must stay under 4000 characters.")
    result = await prepare_draft(content, categories, settings)
    value.structured_draft = result["draft"]
    value.model_config_id = settings.ai_model if result["provider"] == "ai" else "rules-v1"
    value.status, value.confirmed_at = "active", None
    session.add(TriageMessage(session_id=session_id, role="user", content=payload.message))
    session.add(TriageMessage(session_id=session_id, role="assistant", content=result["draft"]["follow_up"]))
    await session.commit()
    return result


@router.post("/triage/sessions/{session_id}/confirm")
async def confirm_triage(session_id: UUID, actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    value = await owned_triage(session_id, actor, session)
    if not value.structured_draft:
        raise HTTPException(409, "Prepare a draft before confirming.")
    value.status, value.confirmed_at = "confirmed", datetime.now(UTC)
    await session.commit()
    return {"id": str(value.id), "status": "confirmed", "requires_human_confirmation": True}


@router.post('/incidents/{incident_id}/review-request', status_code=201)
async def request_review(incident_id: UUID, payload: UpdateCreate, actor: Actor = Depends(get_actor),
                         session: AsyncSession = Depends(get_session)):
    incident = await incident_for(actor, incident_id, session, True)
    if actor.role != Role.RESIDENT or incident.reporter_id != actor.user_id:
        raise HTTPException(403, 'Only the reporter can request review.')
    if incident.status != IncidentStatus.RESOLVED:
        raise HTTPException(409, 'Review requests are available after resolution.')
    limit(actor.user_id, 'review', 5)
    session.add(IncidentUpdate(incident_id=incident_id, author_id=actor.user_id, visibility='public',
                              body='Resident requested review: ' + payload.body[:3900]))
    session.add(AuditLog(actor_id=actor.user_id, action='incident.review_request', entity_type='incident', entity_id=str(incident_id)))
    await session.commit()
    return {'status': 'review_requested'}


from app.schemas import CategoryCreate, DepartmentCreate, ProfileRoleUpdate
from app.models import DepartmentCategory
from sqlalchemy.exc import IntegrityError


def administrator(actor):
    if actor.role != Role.ADMIN:
        raise HTTPException(403, 'Administrator access required.')


@router.post('/admin/departments', status_code=201)
async def new_department(payload: DepartmentCreate, actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    administrator(actor)
    value = Department(id=uuid4(), name=payload.name.strip(), slug=payload.slug)
    session.add(value)
    session.add(AuditLog(actor_id=actor.user_id, action='department.create', entity_type='department', entity_id=str(value.id)))
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, 'Department name or slug already exists.') from exc
    return {'id': str(value.id)}


@router.post('/admin/categories', status_code=201)
async def new_category(payload: CategoryCreate, actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    administrator(actor)
    if payload.department_id:
        department = await session.get(Department, payload.department_id)
        if not department or not department.is_active:
            raise HTTPException(422, 'Select an active department.')
    value = Category(id=uuid4(), name=payload.name.strip(), slug=payload.slug)
    session.add(value)
    try:
        await session.flush()
        if payload.department_id:
            session.add(DepartmentCategory(department_id=payload.department_id, category_id=value.id))
        session.add(AuditLog(actor_id=actor.user_id, action='category.create', entity_type='category', entity_id=str(value.id)))
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(409, 'Category name or slug already exists.') from exc
    return {'id': str(value.id)}


@router.patch('/admin/profiles/{profile_id}')
async def change_role(profile_id: UUID, payload: ProfileRoleUpdate, actor: Actor = Depends(get_actor), session: AsyncSession = Depends(get_session)):
    administrator(actor)
    if profile_id == actor.user_id:
        raise HTTPException(409, 'Ask another administrator to change your own privileges.')
    value = await session.get(Profile, profile_id)
    if value is None:
        raise HTTPException(404, 'Account profile not found. The user must register first.')
    if payload.role in {'staff', 'manager'} and not payload.department_id:
        raise HTTPException(422, 'Staff and managers require a department.')
    if payload.role == 'resident' and payload.department_id:
        raise HTTPException(422, 'Residents cannot have a staff department.')
    if payload.department_id:
        department = await session.get(Department, payload.department_id)
        if not department or not department.is_active:
            raise HTTPException(422, 'Select an active department.')
    session.add(AuditLog(actor_id=actor.user_id, action='profile.role_change', entity_type='profile', entity_id=str(profile_id),
                        event_metadata={'old_role': value.role, 'new_role': payload.role, 'department_id': str(payload.department_id) if payload.department_id else None}))
    value.role, value.department_id = payload.role, payload.department_id
    await session.commit()
    return {'id': str(value.id), 'role': value.role}
