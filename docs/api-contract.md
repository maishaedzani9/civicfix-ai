# REST API Contract

Base path: `/api/v1`

All JSON responses use UTF-8. Protected endpoints require a bearer access token. Timestamps use ISO 8601 UTC. API errors follow:

```json
{
  "error": {
    "code": "validation_error",
    "message": "One or more fields are invalid.",
    "request_id": "req_01J...",
    "details": []
  }
}
```

## Health

### `GET /health`

Returns service availability without database secrets.

```json
{"status":"ok","service":"civicfix-api"}
```

## Categories

### `GET /categories`

Returns active public categories. Authentication is optional.

## Incidents

### `POST /incidents`

Role: resident or authorised staff.

```json
{
  "category_id": "7d9f564d-0ee8-4d7b-94f6-6801e61c7765",
  "title": "Large water leak near university entrance",
  "description": "Water is flowing across the left traffic lane.",
  "latitude": -25.8259,
  "longitude": 25.6122,
  "address_text": "University entrance, Mmabatho",
  "suggested_urgency": "high",
  "ai_triage_id": "a88dce44-5aa7-45af-93ba-7ca4b5528eab"
}
```

Returns `201 Created` with a public-safe reference number.

### `GET /incidents`

- Resident: returns only their incidents.
- Staff: returns incidents within authorised department scope.
- Query: `status`, `category_id`, `department_id`, `urgency`, `from`, `to`, `cursor`, `limit`.
- Maximum `limit`: 100.

### `GET /incidents/{incident_id}`

Returns the incident, permitted evidence metadata, public updates, and status history. Internal notes are returned only to authorised staff.

### `PATCH /incidents/{incident_id}`

Residents may edit drafts. Authorised staff may correct category or urgency; corrections require a reason and are audited.

### `POST /incidents/{incident_id}/status-transitions`

```json
{
  "to_status": "acknowledged",
  "public_message": "Your report has been received and is being assessed.",
  "internal_note": null
}
```

Returns `409 Conflict` for an invalid transition.

### `POST /incidents/{incident_id}/assignments`

Role: manager or administrator.

```json
{
  "department_id": "53b7cc5c-9b02-43f6-83dc-1a44602fa747",
  "assignee_id": null
}
```

## Evidence

### `POST /incidents/{incident_id}/evidence/upload-request`

Validates file metadata and returns a short-lived signed upload target. Allowed initial types: JPEG, PNG, and WebP. The backend enforces final object metadata before linking evidence.

## AI triage

### `POST /triage/sessions`

Creates a short-lived triage session owned by the authenticated user.

### `POST /triage/sessions/{session_id}/messages`

```json
{"message":"There is a large water leak near the university entrance."}
```

Returns assistant text plus a draft conforming to `docs/ai-contract.md`. The server strips secrets, limits length, validates structured output, and records the model configuration identifier.

### `POST /triage/sessions/{session_id}/confirm`

Confirms the latest valid structured draft. Confirmation alone does not bypass the normal `POST /incidents` validation and authorisation rules.

## Analytics

### `GET /analytics/summary`

Role: manager or administrator. Returns authorised aggregates only; never resident contact information or conversation content.

## Idempotency and concurrency

- Incident creation accepts an `Idempotency-Key` header.
- Updates use `updated_at` or a version token to reject stale writes.
- Request IDs are returned in response headers and error bodies.
