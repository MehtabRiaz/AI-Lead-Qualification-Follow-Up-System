# Engineering Standards

## TypeScript and architecture

- Use strict TypeScript, Zod boundary schemas, pure domain functions, and dependency injection for integrations.
- The domain layer cannot import Next.js, Supabase, OpenAI, Slack, or n8n.
- Route handlers translate transport input into domain input and render domain results; they do not own business rules.
- Use UTC ISO timestamps and stable uppercase enum values at persistence boundaries.

## Web and accessibility

- Prefer server components; use client components only for interaction.
- Use semantic HTML, visible labels, keyboard-accessible controls, focus states, and WCAG AA color contrast.
- Lead-facing responses contain only receipt status and a public submission identifier.

## APIs and errors

- Validate request bodies, headers, environment variables, integration responses, and database reads.
- Return stable error codes with safe messages. Log correlation IDs, not raw PII.
- All mutating endpoints are idempotent or explicitly reject replay.

## Tests and commits

- Unit-test domain branches and score boundaries; integration-test persistence and failure recovery.
- A feature is complete only after format, lint, typecheck, unit tests, and build pass.
- Use Conventional Commits with a concise subject and explain non-obvious reasons in the body.
