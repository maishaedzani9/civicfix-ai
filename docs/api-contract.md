# REST API Contract

Base path: `/api/v1`. Protected requests carry a bearer token issued by Supabase Auth (or the explicitly isolated local demo). Role and department permissions come from the user's database profile. Dates are UTC ISO 8601.

Errors use `{"error":{"code":"…","message":"…","request_id":"…","details":[]}}`; responses also include `X-Request-ID`. Validation errors return 422, unauthenticated access 401, forbidden actions 403, inaccessible objects 404, invalid workflow transitions 409.

## System and identity

| Endpoint | Access | Behaviour |
|---|---|---|
| `GET /health` | Public | API liveness |
| `GET /health/ready` | Public | Database connectivity; 503 when unavailable |
| `GET /me` | Signed in | Current profile ID, name, role and department |
| `GET /categories` | Public | Active category IDs, slugs and names |
| `GET /departments` | Staff | Active department IDs and names |
| `GET /personnel` | Manager/admin | Staff names and IDs in authorised scope |
| `POST /demo/login?persona=resident` | Local demo only | Short-lived local token; 404 outside demo mode |

## Incident creation and reads

### `POST /incidents`

```json
{
  "category_id": "7d9f564d-0ee8-4d7b-94f6-6801e61c7765",
  "title": "Large water leak near university entrance",
  "description": "Water is flowing across the left traffic lane.",
  "urgency": "high",
  "address_text": "University entrance, Mmabatho",
  "latitude": -25.8259,
  "longitude": 25.6122,
  "ai_triage_id": null
}
```

Category must be active; title 8–140 characters, description 20–4000 characters, address maximum 500. An address or paired valid coordinates is required. Server trims text and assigns a department from the category mapping; unmapped categories enter the administrator queue. Status starts as `submitted` and an initial history/audit event is written transactionally.

If `ai_triage_id` is supplied, it must identify this user's unexpired, confirmed draft session. Submitted field values remain the resident's reviewed values; AI cannot submit directly.

An optional `Idempotency-Key` header (8–120 characters) records a persistent user-scoped retry key. Identical retries return the same incident; different payloads with the same key are rejected. Returns 201 and the incident object, including UUID, reference, category/department, urgency/status, location, version and timestamps.

### `GET /incidents`

Cursor pagination: `limit` 1–100 (default 20), optional `cursor`. Returns `{ "items": [...], "next_cursor": null }`. Residents see their own reports; staff/managers see their department; administrators see all. Search and status filtering in this release operate on loaded frontend pages.

### `GET /incidents/{incident_id}`

Returns the authorised incident or 404. No reporter name, email or internal notes are embedded in this response.

### `GET /incidents/{incident_id}/activity`

Returns `updates`, `history` and photo metadata. Resident updates contain only public messages; internal updates are staff-only. History contains status/timestamp entries and never internal note text.

## Workflow

### `POST /incidents/{incident_id}/status-transitions`

Staff access, authorised department scope.

```json
{"to_status":"acknowledged","public_message":"Your report has been received.","internal_note":null}
```

Allowed progression: submitted → acknowledged/rejected; acknowledged → assigned/rejected; assigned → in progress; in progress → resolved; resolved → closed/in progress. Closed/rejected are terminal. **Assignment uses the manager assignment endpoint**, not a generic transition. Mutations lock the report row and write history, separate public/internal updates, and audit records in one transaction.

### `POST /incidents/{incident_id}/assignments`

Manager/admin only. Managers may assign within their department; only admins can reroute across departments. Acknowledge before assigning. Optional assignee must be staff in the selected department.

```json
{"department_id":"53b7cc5c-9b02-43f6-83dc-1a44602fa747","assignee_id":null}
```

Closes an existing active assignment, creates the new assignment, and records the event. Acknowledged reports become assigned; reassignment of assigned/in-progress reports preserves their status.

### `POST /incidents/{incident_id}/updates`

Staff only; `{ "body": "Progress message", "visibility": "public" }`. Visibility can be public/internal. Body length 1–4000.

### `PATCH /incidents/{incident_id}`

Staff correction: category ID, urgency, reason and current version are required. Stale versions return 409. The correction is audited and an internal explanation is retained. Category correction does not silently reroute an existing assignment; administrators can explicitly reroute it.

### `POST /incidents/{incident_id}/review-request`

The resident reporter can request staff review after resolution. Accepts a message body, always stores a public review request. Staff decide whether to reopen; the resident cannot change workflow status directly.

## Evidence

### `POST /incidents/{incident_id}/evidence`

Authenticated multipart upload using field `file`. The API checks report scope, accepts JPEG/PNG/WebP up to 10 MB / 20 megapixels, verifies actual image contents, re-encodes to JPEG to remove EXIF, and stores privately. Maximum five photos. Returns 201 and an evidence ID. A failed upload does not delete an already-created incident.

### `GET /incidents/{incident_id}/evidence/{evidence_id}`

Authenticated image retrieval with the same report scope checks. Returns private, non-cacheable JPEG content. No public object URL is exposed.

## AI drafts

### `POST /triage/sessions`

Creates a user-owned 24-hour draft session. Returns session ID/expiry.

### `POST /triage/sessions/{session_id}/messages`

`{"message":"There is a water leak near the campus entrance."}`. Messages are 20–4000 characters, conversation total maximum 4000, ten user messages/session. Returns schema-validated draft fields, follow-up, urgency reason, confidence and immediate-danger flag, plus provider/notice. A new message invalidates prior confirmation.

### `POST /triage/sessions/{session_id}/confirm`

Records human confirmation of a prepared draft. It does not create an incident or bypass normal validation. Ownership and expiry are checked. The frontend calls this only after the resident reviews and confirms the editable report.

`POST /triage/draft` is a stateless convenience adapter for one-shot drafts. It uses the same validations and never creates an incident.

## Operations and administration

| Endpoint | Access | Behaviour |
|---|---|---|
| `GET /analytics/summary` | Staff | Scoped counts by status/category/department/date, overdue targets and median timing aggregates |
| `GET /exports/incidents.csv` | Staff | Scoped export; user strings escaped against spreadsheet formula execution |
| `GET /audit` | Admin | Latest 100 audit records |
| `POST /admin/departments` | Admin | Add unique name/slug |
| `POST /admin/categories` | Admin | Add unique name/slug and optional department mapping |
| `PATCH /admin/profiles/{profile_id}` | Admin | Set existing user's role and valid department; self privilege changes rejected |

AI/session/photo/review endpoints have per-worker rate limits. For multiple replicas, configure a shared limiter at the API gateway.
