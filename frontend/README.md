# CivicFix AI Frontend

Resident-facing web experience for CivicFix AI, a civic issue reporting platform. This milestone includes a public landing page, authentication prototypes, a resident dashboard, and an AI-assisted incident report workflow.

## Routes

- `/` — public product overview
- `/login` and `/register` — authentication prototypes
- `/dashboard` — resident report summary and status tracking
- `/report` — AI-assisted report drafting and confirmation

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production verification

```bash
npm run build
```

## Current milestone scope

The interface uses demonstration data and client-side interactions. It intentionally does not send reports to a municipality or call an AI service yet. The next milestone will connect these screens to the existing FastAPI and Supabase-compatible authentication backend.

## Accessibility and trust

- Semantic headings and labelled controls
- Keyboard-accessible navigation and form controls
- Editable AI suggestions that require explicit resident confirmation
- Clear demonstration-state disclosure
- Guidance to avoid uploading unnecessary personal information
