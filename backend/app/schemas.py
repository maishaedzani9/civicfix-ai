from datetime import UTC, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator

from app.domain.incidents import IncidentStatus, UrgencyLevel


class IncidentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    ai_triage_id: UUID | None = None
    category_id: UUID
    title: str = Field(min_length=8, max_length=140)
    description: str = Field(min_length=20, max_length=4000)
    urgency: UrgencyLevel = UrgencyLevel.MEDIUM
    address_text: str | None = Field(default=None, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def coordinates_must_be_paired(self) -> "IncidentCreate":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be supplied together")
        if not self.address_text and self.latitude is None:
            raise ValueError("An address or map location is required")
        return self


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reference_number: str
    reporter_id: UUID
    category_id: UUID
    department_id: UUID | None
    title: str
    description: str
    urgency: UrgencyLevel
    status: IncidentStatus
    address_text: str | None
    latitude: float | None
    longitude: float | None
    version: int
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def utc_timestamp(self, value: datetime) -> str:
        return (value if value.tzinfo else value.replace(tzinfo=UTC)).astimezone(UTC).isoformat()


class IncidentPage(BaseModel):
    items: list[IncidentRead]
    next_cursor: str | None = None


class StatusTransitionCreate(BaseModel):
    to_status: IncidentStatus
    public_message: str | None = Field(default=None, max_length=1000)
    internal_note: str | None = Field(default=None, max_length=1000)


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str
    details: list[dict] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    error: ErrorBody


class UpdateCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    body: str = Field(min_length=1, max_length=4000)
    visibility: str = Field(default="public", pattern="^(public|internal)$")


class AssignmentCreate(BaseModel):
    department_id: UUID
    assignee_id: UUID | None = None


class TriageCreate(BaseModel):
    message: str = Field(min_length=20, max_length=4000)


class DraftRead(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: str
    title: str = Field(min_length=8, max_length=140)
    description: str = Field(min_length=20, max_length=4000)
    suggested_urgency: UrgencyLevel
    address_text: str | None
    follow_up: str
    immediate_danger: bool
    urgency_reason: str = Field(min_length=8, max_length=500)
    confidence: float = Field(ge=0, le=1)


class CorrectionCreate(BaseModel):
    category_id: UUID
    urgency: UrgencyLevel
    reason: str = Field(min_length=8, max_length=1000)
    version: int = Field(ge=1)


class CategoryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=100)
    slug: str = Field(pattern=r'^[a-z0-9]+(?:_[a-z0-9]+)*$', max_length=100)
    department_id: UUID | None = None


class DepartmentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$', max_length=120)


class ProfileRoleUpdate(BaseModel):
    role: str = Field(pattern='^(resident|staff|manager|admin)$')
    department_id: UUID | None = None
