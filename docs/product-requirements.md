# Product Requirements

## 1. Product statement

CivicFix AI helps residents submit complete, trackable infrastructure reports and helps operational teams triage and resolve them through a shared workflow.

## 2. Target users

| User | Need |
|---|---|
| Resident | Submit a clear report without knowing departmental terminology |
| Staff member | Review, classify, update, and communicate about reports |
| Department manager | Assign work and monitor workload and response times |
| System administrator | Manage categories, departments, permissions, and auditability |

## 3. MVP scope

### Included

- Email-based registration and authentication
- Resident, staff, manager, and administrator roles
- Manual form and chatbot-assisted report creation
- Category, description, urgency suggestion, address, map coordinates, and image evidence
- Explicit resident confirmation before final submission
- Unique public-safe reference number
- Status lifecycle: submitted, acknowledged, assigned, in progress, resolved, closed, rejected
- Staff assignment, public updates, private staff notes, and immutable status history
- Resident report history and status tracking
- Search and filtering for staff
- Basic dashboard counts and response-time summaries
- Audit log for privileged changes

### Excluded from the MVP

- Dispatching emergency responders
- Automatic enforcement or legal decisions
- Facial recognition or identity inference from images
- Public display of reporter identities or exact private addresses
- Autonomous incident submission without user confirmation
- Custom-trained computer vision
- Native mobile applications

## 4. Functional requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| FR-01 | A resident can create an account and sign in | Authenticated session identifies a unique user |
| FR-02 | A resident can draft a report manually | Required fields are validated before submission |
| FR-03 | The assistant can collect report details conversationally | The assistant returns schema-valid structured data |
| FR-04 | AI output requires confirmation | No incident is submitted until the resident confirms the summary |
| FR-05 | A report can include a map location | Latitude and longitude are stored within valid ranges |
| FR-06 | A report can include images | Only allowed types and sizes are accepted; object storage paths are recorded |
| FR-07 | The system generates a reference number | Reference is unique and does not expose sequential database IDs |
| FR-08 | Residents see only their own reports | Cross-user access returns 404 or 403 without leaking report data |
| FR-09 | Staff can update status | Every change records actor, old state, new state, and timestamp |
| FR-10 | Managers can assign incidents | Assignment is restricted to authorised departments and personnel |
| FR-11 | Staff can add public and internal updates | Internal notes never appear in resident responses |
| FR-12 | Users can flag incorrect AI suggestions | Confirmed human values override AI suggestions |
| FR-13 | Managers can view operational summaries | Counts can be grouped by status, category, department, and date |

## 5. Non-functional requirements

- **Accessibility:** keyboard-operable forms, semantic labels, visible focus, sufficient colour contrast, and descriptive error messages.
- **Performance:** normal authenticated API reads should target a p95 response under 500 ms excluding AI generation and large uploads.
- **Reliability:** database changes that create status history or assignments must be transactional.
- **Privacy:** collect the minimum personal information needed; never include private contact data in AI prompts unless essential.
- **Security:** server-side authorisation on every protected operation; client-side hiding is not access control.
- **Observability:** structured logs must include request and correlation IDs without storing raw secrets or full AI conversations.
- **Portability:** business logic must not depend directly on one AI vendor.
- **Explainability:** suggested category and urgency include a short reason and confidence value.

## 6. Primary user journeys

### Resident submits with AI assistance

1. Resident signs in and starts a report.
2. Assistant asks what happened, where it happened, and whether danger is immediate.
3. Resident adds location and optional evidence.
4. Assistant proposes structured fields and lists missing information.
5. Resident edits or confirms the summary.
6. Server validates and creates the incident.
7. Resident receives a reference number and tracking view.

### Staff resolves a report

1. Staff opens their authorised queue.
2. Staff reviews evidence and AI suggestions.
3. Staff corrects classification if needed and records a reason.
4. Manager assigns a department or staff member.
5. Staff posts progress updates.
6. Staff marks the incident resolved with a resolution note.
7. Resident can acknowledge resolution or request review.

## 7. Success measures

- Percentage of submitted reports containing category, description, and valid location
- Median time from submission to acknowledgement
- Median time from acknowledgement to assignment
- Percentage of AI suggestions accepted or corrected by humans
- Reopened-report rate
- Resident completion rate for chatbot-assisted reporting

No target values should be claimed until a seeded demonstration or user test establishes a baseline.

## 8. Definition of done for every feature

- Acceptance criteria are documented.
- Server-side validation and authorisation are implemented.
- Success and failure tests pass.
- Empty, loading, and error UI states exist.
- Logs contain no secrets or unnecessary personal data.
- Documentation and screenshots reflect actual behaviour.
