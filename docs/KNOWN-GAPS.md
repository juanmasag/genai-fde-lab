# Known Gaps

## Repository automation

GitHub Actions hygiene checks are designed but not committed yet because the current GitHub OAuth token does not include the workflow permission required to create workflow files.

Planned checks:

- reject committed .env files;
- verify every lab contains a README;
- run lint/tests as each lab becomes executable.

This is intentionally documented instead of silently bypassed.
