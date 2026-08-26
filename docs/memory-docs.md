# Memory Documentation

- `AGENTS.md` is the concise operational entry point and should stay under roughly 100 lines.
- `project-spec.md` owns product behavior and acceptance criteria.
- `standards.md` owns durable engineering conventions.
- `guardrails.md` owns non-negotiable safety and scope constraints.
- `DECISIONS.md` records architecture choices and consequences.
- `PROMPTS.md` versions production prompts and evaluation notes.

Update the narrowest owning document. Do not copy the same rule into multiple files. Review these documents whenever a milestone completes or a model/dependency change invalidates an assumption.

## Automation pipeline memory

### Purpose and ownership

The single n8n workflow is named **AI Lead Qualification & Follow-Up**. It coordinates persisted lead processing, recovery, and follow-up drafting. It does not validate leads, calculate scores, interpret AI output, or choose routes. Those business decisions remain in the application's pure qualification domain.

- Remote workflow ID: `D0IeARy4XuQq48lm`
- Production webhook path: `/webhook/lead-intake`
- Portable source: `automation/n8n/workflows/ai-lead-qualification-follow-up.json`
- Application-facing API: `src/app/api/leads/route.ts`
- Protected orchestration API: `src/app/api/internal/`
- Qualification service: `src/services/lead-service.ts`
- Deterministic decision engine: `src/domain/qualification.ts`
- Persistence adapters: `src/data/`

### End-to-end data flow

```text
Lead form or API client
  -> POST /api/leads
  -> validate and normalize with Zod
  -> hash the idempotency key
  -> persist the submission as PENDING_AUTOMATION
  -> POST { submissionId } to the n8n intake webhook
  -> n8n calls POST /api/internal/process
  -> application runs duplicate checks, deterministic gates, optional AI analysis,
     scoring, risk, urgency, and routing
  -> application persists the qualification result and follow-up checkpoints
  -> n8n optionally sends a minimal Slack notification
```

The lead is stored before n8n is contacted. If n8n is unavailable, the public submission can remain accepted and the recovery branch processes it later.

### Public input

The normal external entry point is `POST /api/leads`. The browser form in `src/components/lead-form.tsx` submits the same shape.

Required lead fields include contact name, work email, company name, website, industry, requested service, geography, and current challenge. Optional or unknown commercial and identity values are sent as `null`; they must never be invented.

The request may include an `idempotency-key` header. The application normalizes and hashes the key before persistence. If no key is supplied, it derives a daily key from normalized email and company name.

### Public output

A newly accepted submission returns HTTP `202`; an idempotent replay returns HTTP `200`. Both expose only:

```json
{
  "accepted": true,
  "submissionId": "public submission UUID",
  "receivedAt": "UTC ISO timestamp",
  "message": "Thanks — your request has been received."
}
```

The public response must never contain scores, classification, routing, risk, AI output, evidence, or internal workflow state.

### n8n intake branch

The application sends this request after persistence:

```http
POST /webhook/lead-intake
content-type: application/json
x-n8n-secret: shared secret

{"submissionId":"submission UUID"}
```

The webhook runs only when `x-n8n-secret` matches `N8N_SHARED_SECRET`. It responds immediately, then **Process persisted submission** calls:

```http
POST {APP_BASE_URL}/api/internal/process
x-n8n-secret: shared secret

{"submissionId":"submission UUID"}
```

The protected application endpoint validates the body, loads the persisted record, avoids reprocessing terminal records, and returns the internal result:

```json
{
  "submissionId": "submission UUID",
  "status": "COMPLETED or HUMAN_REVIEW",
  "result": "canonical qualification result"
}
```

Each application HTTP call is configured for three attempts with a two-second delay and a 30-second timeout.

### Recovery branch

Every five minutes, **Check pending submissions every five minutes** calls:

```http
GET {APP_BASE_URL}/api/internal/pending
x-n8n-secret: shared secret
```

The endpoint returns up to 20 `PENDING_AUTOMATION` or `RETRYABLE_FAILURE` records as `{ id, status, attempts }`. n8n splits the `submissions` array and calls `/api/internal/process` once for each record. Empty result sets stop naturally without creating fake work.

This branch is the recovery mechanism for a failed initial webhook notification or a temporary n8n/application outage. Application idempotency and terminal-state checks make repeated recovery calls safe.

### Follow-up branch

Every hour, **Check due follow-ups hourly** calls:

```http
POST {APP_BASE_URL}/api/internal/follow-ups
x-n8n-secret: shared secret
```

The application loads up to 50 due scheduled checkpoints and converts them into outbound email drafts. The response contains `processed`, `followUpIds`, and `mode: "draft_only"`. V1 does not send real email.

### Optional Slack output

**Optional Slack notification** is present but disabled. When `SLACK_WEBHOOK_URL` is configured and the node is enabled, it runs after successful intake processing. Its message contains only the classification, route, and submission ID. It does not send raw lead PII, AI evidence, or internal prompts.

Idempotent replays do not notify n8n again, which prevents duplicate Slack messages through the ordinary intake path.

### Configuration and environment selection

The workflow uses:

- `APP_BASE_URL`: application origin currently targeted by the workflow, without a trailing slash.
- `N8N_SHARED_SECRET`: identical secret configured in the application and n8n.
- `SLACK_WEBHOOK_URL`: optional; required only if the disabled Slack node is enabled.
- Application `N8N_WEBHOOK_URL`: the remote production webhook URL ending in `/webhook/lead-intake`.

There is one shared workflow rather than separate development and production copies. Change `APP_BASE_URL` to select which reachable application environment it operates against; one target is active at a time. Never use `/webhook-test/` in application configuration.

### Persistence and outputs

The application, not n8n, owns durable business state:

- `lead_submissions`: normalized input, idempotency key, attempts, and workflow status.
- `qualification_results`: canonical decision output.
- `activities`: append-only qualification activity.
- `follow_ups`: scheduled T+24h, T+72h, and T+7d checkpoints.
- `outbound_drafts`: draft-only follow-up content.
- `workflow_runs`: reserved for detailed orchestration audit work in the next iteration.

The internal dashboard reads recent persisted submissions and qualification results. It is an operator view, not another decision engine.

### Safety invariants

- Persist before orchestration so an integration outage cannot lose an accepted lead.
- Validate external inputs and structured AI output with Zod.
- Keep scoring and routing deterministic and outside n8n.
- Skip unnecessary AI calls for suspicious, duplicate, or insufficient submissions.
- Preserve unknown data as `null`.
- Keep the public receipt free of internal decisions.
- Keep email draft-only in V1.
- Preserve idempotency and append-only history.
- Never commit actual secrets, webhook credentials, execution data, or real lead PII.

## Next iteration checklist

- [ ] Run the local application and n8n acceptance checklist, including intake, protected internal endpoints, idempotent replay, recovery after an n8n outage, and scheduled follow-up processing.
- [ ] Apply and verify the Supabase migration, confirm persistence across application restarts, and test duplicate and idempotency behavior against the database.
- [ ] Implement human override controls and deterministic follow-up cancellation for replies, bookings, rejections, and manual status changes.
- [ ] Complete duplicate resolution for possible name-and-company matches and existing-account/new-contact submissions while preserving append-only history.
- [ ] Persist workflow-run attempts, retryable failures, errors, timings, and recovery outcomes in the audit trail.
- [ ] Make qualification-result, activity, and follow-up persistence atomic or otherwise prove safe recovery from partial writes.
- [ ] Expand Zod validation across remaining external boundaries and database fields.
- [ ] Verify OpenAI structured analysis and safe fallback behavior with a configured development credential.
- [ ] Verify optional Slack delivery is exactly once and does not expose unnecessary lead PII or internal AI evidence.
- [ ] Run browser E2E tests and the full `pnpm check` gate after the behavior gaps are closed.
- [x] Import and publish the combined workflow in the target n8n instance.
- [ ] Configure the published workflow's application environment, then run the production deployment smoke test across Vercel, Railway, Supabase, and n8n.
- [ ] Update the project specification checklists to reflect verified completion, then record the demo and publish an evidence-based case study.
