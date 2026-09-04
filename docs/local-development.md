# Local Setup and Test Runbook

Use this runbook before production deployment. It starts with a zero-credential demo, then adds local n8n, and finally offers isolated tests of Supabase, OpenAI, and Slack. Use fictional lead data throughout.

## What each checkpoint proves

1. **App-only demo:** form, API validation, deterministic qualification, routing, dashboard, tests, and build.
2. **Local n8n:** webhook delivery, protected internal endpoints, workflow execution, retry polling, and optional Slack delivery.
3. **Local Supabase:** migrations, persistent data, Row Level Security posture, and repository integration.
4. **OpenAI:** structured analysis and deterministic fallback behavior.

Complete checkpoints 1 and 2 before configuring production. Checkpoints 3 and 4 are recommended when the corresponding provider will be enabled in production.

## 1. Prerequisites

Install:

- Git
- Node.js 20 or newer
- pnpm 10 (`corepack enable` can activate the package manager declared by the repository)
- Docker Desktop or another Docker Engine with Compose, for n8n and local Supabase

Confirm the tools that apply to the checkpoint you are running:

```bash
node --version
pnpm --version
git --version
docker --version
docker compose version
```

Run every command below from the repository root.

## 2. Install and validate the repository

```bash
pnpm install
pnpm check
```

`pnpm check` runs formatting, linting, strict type checking, 13 qualification scenarios, and a production build. Do not continue if it fails.

## 3. Checkpoint 1: app-only demo

Create the Next.js environment file:

```bash
cp .env.example .env.local
```

Confirm these values in `.env.local`:

```dotenv
APP_BASE_URL=http://localhost:3000
DATA_MODE=demo
NEXT_PUBLIC_DEMO_MODE=true
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
N8N_WEBHOOK_URL=
N8N_SHARED_SECRET=replace-with-a-long-random-value
SLACK_WEBHOOK_URL=
```

Leaving `N8N_WEBHOOK_URL` blank is important at this checkpoint. It makes the demo process an accepted submission immediately inside the application. Demo data is held in memory and resets whenever the development server restarts.

Start the app:

```bash
pnpm dev
```

Open:

- `http://localhost:3000` for the public lead form
- `http://localhost:3000/dashboard` for the internal demo dashboard

Submit a fictional lead. The form should show only a receipt/reference ID. It must not reveal a score, classification, risk, AI output, or internal route. Open the dashboard and confirm the lead has a completed qualification result.

### App-only API test

In a second terminal, send a fictional lead:

```bash
curl -i -X POST 'http://localhost:3000/api/leads' \
  -H 'content-type: application/json' \
  -H 'idempotency-key: local-demo-001' \
  --data '{
    "contactName":"Local Test",
    "workEmail":"local-test-001@example.com",
    "companyName":"Example Test Company",
    "website":"https://example.com",
    "roleTitle":"Founder",
    "seniority":"FOUNDER",
    "industry":"B2B_SAAS",
    "employeeCount":25,
    "annualRevenueUsd":1000000,
    "monthlyAdSpendUsd":10000,
    "serviceNeeded":"GROWTH_MARKETING",
    "geography":"United States",
    "currentChallenge":"This is a fictional local deployment verification submission.",
    "leadSource":"local_smoke_test",
    "timeline":"WITHIN_30_DAYS",
    "message":"No follow-up is required; this is test data."
  }'
```

Expected first response: HTTP `202`, `accepted: true`, a public `submissionId`, and no internal decision fields. Repeat the identical request with the same idempotency key. Expected replay: HTTP `200`, the same submission ID, and no second record.

### Boundary and privacy checks

Send invalid input and confirm a safe `400 INVALID_SUBMISSION` response:

```bash
curl -i -X POST 'http://localhost:3000/api/leads' \
  -H 'content-type: application/json' \
  --data '{"contactName":"X"}'
```

Search the successful public response and browser network response manually. They must not contain `score`, `risk`, `routing`, `evidence`, or AI analysis.

## 4. Checkpoint 2: local n8n orchestration

Stop the Next.js process with `Ctrl-C` before changing environment variables.

Docker Compose reads `.env`, while Next.js reads `.env.local`. Create Docker's local environment file:

```bash
cp .env.example .env
```

Generate two different local secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Put the first output into `N8N_SHARED_SECRET` in both `.env` and `.env.local`. Put the second into `N8N_ENCRYPTION_KEY` in `.env`. These are local-only files ignored by Git.

In `.env.local`, set:

```dotenv
N8N_WEBHOOK_URL=http://localhost:5678/webhook/lead-intake
```

Keep `DATA_MODE=demo` and leave Supabase/OpenAI/Slack blank for the first n8n test.

Start n8n:

```bash
docker compose up -d
docker compose ps
docker compose logs --tail=100 n8n
```

Open `http://localhost:5678`, create the local owner account if prompted, and use **Import from File** for `automation/n8n/workflows/ai-lead-qualification-follow-up.json`.

Activate **AI Lead Qualification & Follow-Up**. It contains the intake, five-minute recovery, and hourly follow-up branches. Leave **Optional Slack notification** disabled.

Start Next.js again:

```bash
pnpm dev
```

Repeat the browser or API submission with a new email and idempotency key. Verify:

1. the public API returns `202` without internal decision data;
2. **AI Lead Qualification & Follow-Up** has a successful intake execution in n8n;
3. its HTTP node calls `http://host.docker.internal:3000/api/internal/process` successfully;
4. the dashboard shows the processed result; and
5. replaying the request does not trigger a second workflow execution.

### Recovery test

This proves that a temporary n8n outage does not lose a persisted lead.

1. Stop n8n: `docker compose stop n8n`.
2. Submit a new fictional lead while Next.js remains running.
3. Confirm the form still accepts it and the dashboard shows `PENDING_AUTOMATION`.
4. Restart n8n: `docker compose start n8n`.
5. Within approximately five minutes, the recovery workflow should load and process the pending submission.
6. Confirm the dashboard leaves `PENDING_AUTOMATION` and the n8n execution succeeds.

The demo repository is in process memory, so do not restart Next.js during this recovery test.

### Stop the local stack

```bash
docker compose down
```

This preserves `automation/n8n/data`. Do not use `down -v` unless you intentionally want to discard local n8n state.

## 5. Checkpoint 3: local Supabase persistence

This optional checkpoint replaces in-memory demo storage with a local PostgreSQL/Supabase stack. Docker must be running.

If `supabase/config.toml` does not exist, initialize the local Supabase project once:

```bash
npx supabase init
```

Start Supabase and apply the committed migration:

```bash
npx supabase start
npx supabase db reset
npx supabase status
```

`db reset` is destructive only to the local Supabase development database. Never add `--linked` or a production database URL to this command.

From `npx supabase status`, copy the local API URL and service-role/secret value into `.env.local`:

```dotenv
DATA_MODE=supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=PASTE_LOCAL_SERVICE_ROLE_VALUE
```

Keep `N8N_WEBHOOK_URL` blank for the first persistence test, restart Next.js, and submit a new fictional lead. Verify the result in the dashboard and in local Supabase Studio (the Studio URL is printed by `npx supabase status`). The tables should include `leads`, `lead_submissions`, and `qualification_results` records.

Now restart Next.js and reload the dashboard. The submitted record should remain, proving persistence. To combine Supabase with n8n, start both services and restore `N8N_WEBHOOK_URL=http://localhost:5678/webhook/lead-intake`.

Stop local Supabase when finished:

```bash
npx supabase stop
```

## 6. Checkpoint 4: OpenAI in n8n

Use a dedicated development project/key with a low spending limit. In n8n, create an OpenAI credential and connect it to **OpenAI Chat Model** in **AI Lead Qualification & Follow-Up**. The key belongs only in n8n's encrypted credential store; never put it in `.env.local`, the workflow JSON, or source code.

Save and reactivate the workflow, then submit a fictional, valid, sufficiently complete lead. Confirm **Analyze qualitative lead signals** executes and `analysis.aiStatus` is `USED` in **Complete AI-qualified submission**, or in the `qualification_result` JSON in local Supabase Studio. The public response and lead-facing page must never expose this value.

Then test failure safety by temporarily disconnecting the credential from the model node and executing a new fictional submission. The lead must remain stored and route to human review rather than disappearing. Reconnect the credential immediately afterward.

## 7. Slack locally (optional)

Create a development Slack incoming webhook for a test channel. Put the URL in `.env` (Docker/n8n), not `.env.local`, then recreate n8n so it receives the changed variable:

```bash
docker compose up -d --force-recreate n8n
```

In **AI Lead Qualification & Follow-Up**, enable **Optional Slack notification**, save, and reactivate the workflow. Submit a new fictional lead and confirm exactly one message. Replay the same idempotency key and confirm no duplicate Slack message.

Disable the node again if Slack is not part of the intended production configuration.

## 8. Final local acceptance checklist

- [ ] `pnpm check` passes.
- [ ] Public form and dashboard render locally.
- [ ] Valid submission returns only a safe receipt.
- [ ] Invalid submission returns `400 INVALID_SUBMISSION`.
- [ ] Replaying an idempotency key does not duplicate a lead or notification.
- [ ] The combined n8n workflow imports and activates with all three trigger branches.
- [ ] n8n calls the protected internal application endpoints successfully.
- [ ] An n8n outage retains the lead and recovery later processes it.
- [ ] Local Supabase data survives an application restart, if Supabase will be used.
- [ ] OpenAI reports `USED` for a valid test, if OpenAI will be used.
- [ ] OpenAI failure retains and safely routes the lead.
- [ ] Slack posts exactly once, if Slack will be used.
- [ ] `.env` and `.env.local` remain untracked.

Run this final check before moving to production:

```bash
pnpm check
git status --short
```

Review `git status` and confirm it contains no `.env`, `.env.local`, `automation/n8n/data`, credentials, execution data, or real lead data. Then continue with [the production deployment runbook](deployment.md).

## Common local problems

### Submission stays pending in app-only demo

`N8N_WEBHOOK_URL` is set while n8n is not running. Clear it and restart Next.js, or start and activate the local n8n workflow.

### n8n cannot reach Next.js

Confirm Next.js is running on port 3000. The committed Compose file intentionally uses `http://host.docker.internal:3000`; do not replace it with `localhost`, which would refer to the n8n container itself.

### Internal endpoint returns `401`

The `N8N_SHARED_SECRET` values in `.env` and `.env.local` differ. Make them identical, recreate n8n, and restart Next.js.

### Supabase mode fails at startup or returns `503`

Confirm local Supabase is running, copy current values from `npx supabase status`, set both Supabase variables, and restart Next.js.

### Workflow variables appear stale

After editing `.env`, run `docker compose up -d --force-recreate n8n`. After editing `.env.local`, restart `pnpm dev`.
