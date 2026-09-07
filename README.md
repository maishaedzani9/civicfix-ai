# CivicFix AI

An AI-assisted civic infrastructure reporting platform for South African communities.

Residents can report potholes, water leaks, electricity faults, broken streetlights, illegal dumping, and related infrastructure problems. A conversational assistant collects missing details and converts the conversation into a structured report. Municipal or campus operations staff can triage, assign, update, and analyse incidents from a dashboard.

## Why this project matters

Most portfolio chatbots stop at question-and-answer. CivicFix AI connects AI to a complete operational workflow:

1. Collect a report through conversation.
2. Validate location and supporting evidence.
3. Classify the category and suggested urgency.
4. Require human confirmation before submission.
5. Route the incident to a responsible department.
6. Track status, ownership, and response time.

The system is designed as a portfolio project, not as an official emergency service. The chatbot must always direct immediate danger to the appropriate emergency channel.

## Phase 1 status

- [x] Product requirements and user stories
- [x] Architecture and trust boundaries
- [x] PostgreSQL schema with constraints and audit history
- [x] REST API contract
- [x] AI safety and structured-output contract
- [x] Security and privacy checklist
- [x] Automated Phase 1 validation
- [x] FastAPI backend foundation
- [x] JWT verification and PostgreSQL connection layer
- [x] Incident create/list/detail and workflow endpoints
- [ ] Next.js frontend
- [ ] AI provider integration
- [ ] Deployment

## Planned technology stack

| Area | Technology |
|---|---|
| Web application | Next.js, React, TypeScript, Tailwind CSS |
| API | Python, FastAPI, Pydantic |
| Database | PostgreSQL |
| Authentication and storage | Supabase |
| AI orchestration | Provider-independent structured-output adapter |
| Maps | Leaflet and OpenStreetMap |
| Testing | Pytest, Vitest, Playwright |
| Local development | Docker Compose |

## Repository structure

```text
civicfix-ai/
├── database/
│   ├── schema.sql
│   └── seed.sql
├── docs/
│   ├── ai-contract.md
│   ├── api-contract.md
│   ├── architecture.md
│   ├── backend.md
│   ├── product-requirements.md
│   └── security.md
├── scripts/
│   └── validate_phase1.py
├── tests/
│   └── test_phase1_contracts.py
├── .github/workflows/
│   └── phase1-validation.yml
├── .gitignore
├── backend/
│   ├── app/                       # FastAPI application
│   ├── tests/                     # backend domain tests
│   ├── .env.example
│   ├── Dockerfile
│   └── requirements.txt
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── pyproject.toml
```

## Validate Phase 1

The validation uses only the Python standard library:

```bash
python scripts/validate_phase1.py
python -m unittest discover -s tests -v
```

## Core documentation

- [Product requirements](docs/product-requirements.md)
- [System architecture](docs/architecture.md)
- [API contract](docs/api-contract.md)
- [AI contract](docs/ai-contract.md)
- [Security model](docs/security.md)
- [Database schema](database/schema.sql)

## Roadmap

### Phase 2 — Backend foundation

- [x] FastAPI application and health endpoints
- [x] Supabase-compatible JWT verification
- [x] Async PostgreSQL connection
- [x] Incident create, list, and detail operations
- [x] Status transition rules and history writes
- [x] Cursor pagination and role-scoped queries
- [ ] Assignment and public/internal update endpoints
- [ ] Disposable-database integration tests

### Phase 3 — Resident experience

- Responsive report flow
- Conversational AI interface
- Image upload and map selection
- Report confirmation and tracking

### Phase 4 — Operations dashboard

- Staff queues and assignment
- Map and SLA views
- Status updates and internal notes
- Analytics and CSV export

### Phase 5 — Portfolio release

- End-to-end tests
- Accessibility and security review
- Seeded demonstration environment
- Architecture diagram, screenshots, and demo video
- Public deployment

## Author

Edzani Maisha — final-year Computer Science and Electronics student focused on AI, machine learning, and practical software systems.

## License

[MIT](LICENSE)
