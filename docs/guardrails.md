# Guardrails and Review Gate

## Hard constraints

- AI cannot set scores, final routes, validation state, duplicate state, or override deterministic gates.
- Unknown enrichment data remains unknown. No inferred revenue, spend, headcount, identity, or authority.
- Invalid, suspicious, duplicate, and insufficient submissions skip unnecessary AI calls.
- Every accepted submission is persisted before orchestration; temporary failures cannot lose it.
- Public clients never receive internal scores, evidence, risk, confidence, or routing.
- Secrets are server-only and documented only by variable name.
- Real outbound email and autonomous conversations are out of V1.

## AI runtime limits

- Structured output only; local schema validation remains mandatory.
- One analysis call per normalized-input hash and prompt/model version.
- Timeout: 15 seconds. Maximum output: 700 tokens.
- On timeout, refusal, malformed output, or provider failure: retain the lead and route `HUMAN_REVIEW` with a sanitized reason.

## Review gate

- [ ] Change is inside `docs/project-spec.md` scope.
- [ ] Domain invariants remain outside UI, route handlers, and n8n.
- [ ] Boundary input and output are schema-validated.
- [ ] PII, secrets, and internal decisions are not exposed or logged.
- [ ] Idempotency and audit history are preserved.
- [ ] Relevant tests and `pnpm check` pass.
- [ ] Decisions and prompts are updated when applicable.
