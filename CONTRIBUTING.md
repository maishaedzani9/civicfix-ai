# Contributing

## Workflow

1. Create a focused branch from `main`.
2. Link the change to a documented requirement or explain the new requirement.
3. Include validation, authorisation, success, and failure tests.
4. Run the Phase 1 checks before committing:

```bash
python scripts/validate_phase1.py
python -m unittest discover -s tests -v
```

5. Use a clear commit message such as `docs: define incident API contract`.
6. Open a pull request with the problem, approach, security impact, and test evidence.

## Standards

- Never commit credentials, tokens, production data, or resident information.
- Do not present AI-generated classifications as verified facts.
- Keep business rules in the backend and enforce permissions server-side.
- Update documentation and tests with behavioural changes.
- Prefer small pull requests that can be reviewed independently.
