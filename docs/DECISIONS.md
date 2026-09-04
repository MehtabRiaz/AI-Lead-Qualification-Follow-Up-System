# Architecture Decisions

## 2026-08-26 — Domain-owned qualification

**Decision:** Pure TypeScript functions own validation, completeness, scoring, risk, urgency, and routing. Next.js and n8n call this layer.

**Reason:** One decision source prevents drift between the form, dashboard, automation, and tests.

## 2026-08-26 — Persist before orchestration

**Decision:** Store every accepted submission and pending workflow run before invoking n8n.

**Reason:** An unavailable automation service must not lose a lead.

## 2026-08-26 — Hybrid sandbox

**Decision:** Supabase and OpenAI may run live; Slack is optional and email is draft-only. Local in-memory/demo adapters keep the project runnable without credentials.

**Reason:** The portfolio remains reproducible and safe while demonstrating real integration seams.

## 2026-08-26 — Portable n8n source

**Decision:** Commit sanitized workflow JSON and run the same artifacts in local Docker and remote Railway.

**Reason:** Git remains the source of truth and remote hosting does not create workflow lock-in.

## 2026-08-27 — Single shared n8n workflow

**Decision:** Use one final n8n workflow for both development and production operations. The workflow contains independent intake, recovery, and follow-up trigger branches and calls the application selected by `APP_BASE_URL`.

**Reason:** A single orchestration surface keeps the first n8n project understandable while preserving domain ownership in the application. Environment configuration selects the current application target without duplicating workflow logic.

## 2026-09-04 — n8n-owned AI analysis

**Decision:** Eligible qualitative lead analysis runs in an n8n AI Agent with an OpenAI Chat Model and structured output parser. The application exposes a deterministic preparation step, validates returned agent output with Zod, and remains solely responsible for scoring, gates, routing, and persistence.

**Reason:** The automation visibly owns the AI operation while the application continues to enforce deterministic business rules and a provider-independent trust boundary. Intake and recovery use the same agent path, and malformed or unavailable AI output routes safely to human review.
