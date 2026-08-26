# Project agent instructions

Before changing code, read `docs/project-spec.md`, `docs/standards.md`, `docs/guardrails.md`, and `docs/DECISIONS.md`.

## Required workflow

1. Confirm the task is inside V1 scope.
2. Keep business decisions in the pure qualification domain, never in UI or n8n.
3. Validate every external boundary with Zod.
4. Preserve unknown values as `null`; never invent enrichment data.
5. Run `pnpm check` and relevant tests before finishing.
6. Update `docs/DECISIONS.md` when architecture or behavior changes.

## Hard constraints

- Never expose scores, risk, AI output, or internal routing in lead-facing responses.
- Never let AI calculate the deterministic score or bypass routing gates.
- Never commit secrets, real lead PII, n8n credentials, or execution data.
- Preserve idempotency and append-only decision/audit history.
- Stop when the acceptance criteria pass; do not add adjacent CRM features.
