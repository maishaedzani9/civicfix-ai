from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.incidents import IncidentStatus, UrgencyLevel


class IncidentCreate(BaseModel):
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
