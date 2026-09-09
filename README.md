# AI Lead Qualification & Follow-Up System

A production-minded automation for capturing, validating, qualifying, routing, and following up with inbound leads for a fictional digital marketing agency.

The project demonstrates how deterministic business rules and structured AI outputs can work together without handing critical sales decisions entirely to an LLM.

> **Status:** Completed · **Priority:** High · **Type:** Mock portfolio build
>
> The detailed requirements, decision rules, test scenarios, and output contract are documented in [`docs/project-spec.md`](docs/project-spec.md). The source specification is maintained in [Notion](https://app.notion.com/p/3c4625677e33812eb756d45611bc3fe4).

## Project goal

Turn incoming marketing-agency leads into qualified, actionable opportunities with less manual work and faster, more consistent follow-up—while preserving explainability and human control.

The fictional client is **Northstar Growth**, a US performance-marketing agency serving B2B, SaaS, and e-commerce companies seeking paid acquisition or growth-marketing support.

## Implemented workflow

1. Capture a lead from a web form or webhook.
2. Validate and normalize the submitted data.
3. Detect duplicate submissions and preserve activity history.
4. Check whether enough information exists to qualify the lead.
5. Calculate a transparent, deterministic qualification score.
6. Use AI to classify qualitative signals and produce a structured summary.
7. Evaluate risk and urgency independently from the score.
8. Route the lead to the appropriate sales, nurture, verification, or review queue.
9. Draft a personalized response and notify the responsible person.
10. Schedule deterministic follow-ups and maintain an audit trail.

## Decision pipeline

```text
Lead submitted
  -> Validation gate
  -> Duplicate gate
  -> Qualification/data-completeness gate
  -> Score dimensions
  -> Risk gate
  -> Urgency gate
  -> Routing
  -> Action and follow-up
```

Routing gates take precedence over the numerical score. Suspicious, duplicate, incomplete, or high-risk leads receive specialized handling before normal score-based routing.

## Qualification model

The 100-point score measures opportunity quality:

- Commercial value: 25 points
- ICP/company fit: 20 points
- Buying intent: 20 points
- Authority: 15 points
- Problem awareness: 10 points
- Geography/serviceability: 10 points

Base classifications:

- `HOT`: 80–100
- `WARM`: 55–79
- `LOW_FIT`: 0–54

Validation, data completeness, risk, urgency, and duplicate status remain separate dimensions. Missing information remains unknown rather than being converted into a zero or guessed.

## Role of AI

AI is used where interpretation is useful:

- Identifying the underlying pain point
- Classifying intent and qualitative signals
- Summarizing the lead
- Extracting supporting evidence
- Suggesting a next action
- Drafting personalized outreach

Deterministic rules remain responsible for validation, scoring, routing precedence, follow-up timing, and stop conditions.

## Technology stack

- **Frontend:** Next.js and TypeScript
- **Database:** Supabase and PostgreSQL
- **Automation:** n8n
- **AI:** n8n AI Agent with OpenAI and structured output validation
- **Notifications:** Slack
- **Deployment:** Vercel, Supabase, and Docker

Suggested core tables include `leads`, `lead_scores`, `activities`, `workflow_runs`, and `follow_ups`.

## Reliability and safety requirements

- Idempotent webhook processing and duplicate protection
- Retries for temporary integration failures
- Structured workflow and error logging
- Explainable scoring with factor-level evidence
- No hard-coded credentials or secrets
- Minimal transmission of personally identifiable information
- Human overrides for uncertain, suspicious, strategic, or high-risk cases
- Immediate follow-up cancellation after a reply, booking, rejection, or manual status change

## V1 scope

The first version focuses on the lead automation layer. It does not attempt to build:

- A full CRM
- An autonomous sales conversation agent
- A complex multi-user administration portal
- A production email-deliverability platform
- Multi-tenant infrastructure
- Unverified revenue or conversion claims

## Test coverage strategy

The decision model is designed around ten representative scenarios, including:

- Hot and warm opportunities
- Low-fit leads
- Missing qualification data
- High-value nurture accounts
- High-risk opportunities
- Suspicious identity claims
- Duplicate submissions
- Consultative opportunities with ambiguous buying intent

These scenarios are implemented as automated fixtures to verify that changes to the qualification engine do not alter expected routing behavior unintentionally.

## Project status

The requirements, test scenarios, decision gates, scoring dimensions, routing precedence, and canonical qualification output contract have been implemented as a runnable V1 foundation.

Portfolio documentation:

- [Technical review](docs/technical-review.md)
- [Case study](docs/case-study.md)
- [LinkedIn launch pack](docs/linkedin-launch.md)

## Run locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000` for the lead experience and `http://localhost:3000/dashboard` for the fictional internal dashboard. Demo mode does not require credentials.

Follow the [`local setup and test runbook`](docs/local-development.md) to verify app-only demo mode, Dockerized n8n orchestration and recovery, local Supabase persistence, OpenAI fallback behavior, Slack delivery, privacy boundaries, and idempotency before deploying.

After local acceptance passes, the [`production deployment runbook`](docs/deployment.md) provides the complete first-time setup order, secret and environment-variable matrix, Supabase migration commands, Vercel and Railway configuration, n8n workflow activation, smoke tests, troubleshooting, and production security gate.

## Disclaimer

This is a mock portfolio implementation for a fictional agency. Any performance metrics published with the finished case study will come from reproducible technical tests; the project will not claim unmeasured client revenue, conversion, or productivity improvements.
