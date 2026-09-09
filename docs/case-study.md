# Case Study — AI Lead Qualification & Follow-Up System

## Problem

Northstar Growth is a fictional performance-marketing agency receiving leads with inconsistent commercial context. Manual review creates slow response, inconsistent qualification, duplicate work, and unreliable follow-up.

The goal was not to build an autonomous sales agent. It was to create an explainable automation layer that captures every lead, applies consistent business rules, protects ambiguous decisions with human review, and demonstrates a credible production architecture.

## Key decisions

1. **Deterministic rules own the decision.** The LLM never sets the numerical score, validation state, risk state, or final route.
2. **Persist before orchestration.** A lead is stored before n8n is called, so a temporary automation failure cannot lose it.
3. **Unknown is not zero.** Missing budget, authority, or intent stays `null`; partial qualification is explicitly provisional.
4. **Risk and urgency are independent.** A valuable lead can still require human review, while a low-fit lead can still be urgent.
5. **AI is optional and reversible.** The n8n Agent can add structured qualitative analysis, but the deployed system works cleanly with analysis disabled.
6. **Follow-up is draft-only.** V1 creates auditable drafts and schedules without pretending to be a production email platform.

## Architecture

The Next.js application on Vercel owns the public form, protected workflow endpoints, and pure qualification domain. Supabase PostgreSQL is the source of truth. A remote n8n workflow coordinates immediate intake, five-minute recovery, and hourly follow-up drafting. External boundaries are schema-validated and authenticated with a rotated shared secret.

The workflow contains 14 nodes organized into intake, qualitative analysis, recovery, and scheduled follow-up stages. Eligible AI output returns through a Zod-validated completion endpoint; all scores and routes are recalculated by the application.

## Implementation

- Next.js 15 and strict TypeScript
- Zod validation at public, internal, environment, AI-output, and persistence boundaries
- Pure deterministic qualification domain with a six-dimension 100-point rubric
- Supabase schema covering leads, submissions, qualification results, activities, workflow runs, follow-ups, and outbound drafts
- n8n webhook, Agent, structured parser, retrying HTTP nodes, and two schedule triggers
- Idempotency hashing, normalized-email duplicate detection, append-only activity history, and safe terminal states
- Public receipt response that never leaks scores, AI output, risk, or routing

## Demo flow

1. Submit a fictional lead through the production form.
2. The application validates, normalizes, and persists it.
3. n8n requests deterministic preparation.
4. The application returns either a completed decision or a minimal analysis payload.
5. With AI disabled, n8n bypasses the Agent and retains the deterministic result.
6. The internal dashboard displays the canonical decision, gate states, score breakdown, and next action.
7. Scheduled branches recover pending records and create due follow-up drafts.

## Results

- 21 automated tests passed alongside lint, formatting, type checking, and the production build.
- Ten realistic fixtures covered Hot, Warm, Low Fit, missing-data, nurture, high-risk, suspicious, duplicate, and consultative scenarios.
- Duplicate production processing completed without restarting AI or follow-up.
- AI-provider failure completed safely as human review rather than losing the lead.
- Recovery polling and draft-only follow-up branches completed successfully in n8n.
- The deployed workflow uses three independent triggers and retries application calls up to three times.

These are technical outcomes from a mock portfolio implementation, not claims of real conversion lift, revenue impact, or hours saved.

## What I learned

The most important design choice was separating opportunity quality from operational safety. A score is useful, but it is not permission to automate. Validation, completeness, risk, urgency, and duplicate state need independent gates with explicit precedence.

The second lesson was that AI works best as a bounded interpreter. Structured qualitative evidence can improve a decision, but the application still needs to validate that evidence and remain capable of completing without it.

## Links

- Live demo: https://ai-lead-qualification-follow-up-sys.vercel.app
- Source repository: https://github.com/MehtabRiaz/AI-Lead-Qualification-Follow-Up-System
- n8n workflow: https://mehtab-riaz-01.app.n8n.cloud/workflow/PmnynmVrAruuYrsK
