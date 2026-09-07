# Security and Privacy

## Data classification

| Data | Classification | Handling |
|---|---|---|
| Public categories and aggregate counts | Public | Cacheable after review |
| Incident description and approximate location | Sensitive | Authorised access only by default |
| Exact location, email, phone, and account ID | Personal | Minimise, encrypt in transit, restrict access |
| Evidence images | Sensitive | Private bucket and short-lived signed URLs |
| Internal notes and assignments | Internal | Staff scope only |
| Access tokens, service keys, AI keys | Secret | Server-side secret store only |

## Required controls

- Validate tokens and permissions on the API, not only in the browser.
- Enable PostgreSQL row-level security where Supabase clients access tables.
- Keep service-role credentials outside frontend code.
- Use private object storage and non-guessable paths.
- Validate MIME type, extension, decoded content, and file size.
- Strip image metadata when it is not needed.
- Rate-limit authentication, AI messaging, report creation, and upload requests.
- Use parameterised SQL through a vetted database layer.
- Escape user content in HTML and never render untrusted Markdown without sanitisation.
- Record privileged actions in append-only audit logs.
- Do not log access tokens, AI keys, full evidence URLs, or unnecessary personal information.

## Role matrix

| Action | Resident | Staff | Manager | Administrator |
|---|---:|---:|---:|---:|
| Create own report | Yes | Yes | Yes | Yes |
| View own report | Yes | Yes | Yes | Yes |
| View departmental queue | No | Scoped | Scoped | Yes |
| Add internal note | No | Scoped | Scoped | Yes |
| Assign incident | No | No | Scoped | Yes |
| Manage categories/departments | No | No | No | Yes |
| View audit logs | No | No | Scoped | Yes |

## POPIA-minded design checklist

- State the purpose for collecting each personal field.
- Collect only necessary information.
- Provide a privacy notice at collection.
- Define retention periods for reports, conversations, and evidence.
- Support correction and lawful deletion/anonymisation requests.
- Restrict staff access according to job function.
- Document third-party processors and cross-border processing.
- Create an incident-response and breach-notification procedure.

This checklist supports responsible design but is not legal advice.

## Pre-release security tests

- Resident A cannot read or modify Resident B's incident.
- Staff cannot access a department outside their scope.
- Internal notes never appear in resident API responses.
- Invalid or expired signed URLs fail.
- Oversized and spoofed uploads fail safely.
- Invalid status transitions return 409 without partial changes.
- Prompt-injection input cannot invoke privileged operations.
- Replayed incident-creation requests with the same idempotency key do not duplicate records.
