# Production Deployment Runbook

This guide deploys the public Next.js application to Vercel, PostgreSQL data to Supabase, workflow automation to n8n on Railway, AI analysis to OpenAI, and notifications to Slack. Follow the sections in order. Never commit provider credentials or webhook URLs.

Before starting, complete every applicable checkpoint in the [local setup and test runbook](local-development.md). Do not use production credentials to diagnose behavior that has not passed locally.

## 1. Production architecture

1. A user submits the public form hosted by Vercel.
2. Vercel validates and persists the lead in Supabase.
3. Vercel calls the production n8n webhook on Railway.
4. n8n calls a protected internal Vercel endpoint.
5. n8n runs eligible qualitative analysis through its AI Agent and OpenAI Chat Model.
6. Vercel validates the structured output, completes deterministic qualification, and stores the result in Supabase.
7. n8n optionally posts the result to Slack.
8. The Vercel dashboard reads recent results from Supabase.

The services must be wired in both directions:

- Vercel `N8N_WEBHOOK_URL` -> Railway `/webhook/lead-intake`
- Railway `APP_BASE_URL` -> Vercel HTTPS origin
- Vercel and Railway -> the exact same `N8N_SHARED_SECRET`

## 2. Security gate before real users

The V1 dashboard at `/dashboard` has no authentication. The database is not directly exposed to browsers, and Row Level Security has no anonymous policies, but anyone who knows the application URL can open the server-rendered dashboard.

Before collecting real personal or customer data, add authentication and authorization to `/dashboard`, or restrict the whole Vercel deployment with access controls and invite only trusted users. Do not advertise the deployment publicly until this is done. The lead form is intended to be public; the operations dashboard is not.

## 3. Accounts and prerequisites

Obtain a GitHub repository, Supabase project, OpenAI API project with billing, Slack workspace, Vercel account connected to GitHub, and Railway account.

Install Node.js 20+, pnpm 10, Git, and the Supabase CLI (or use `npx supabase`). From the repository root, verify the release:

```bash
pnpm install
pnpm check
git status --short
```

`pnpm check` must pass. Never commit `.env`, `.env.local`, API keys, or webhook URLs.

## 4. Generate secrets

Generate two different secrets and save them in a password manager:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Use the first as `N8N_SHARED_SECRET` on Vercel and Railway. Use the second as `N8N_ENCRYPTION_KEY` on Railway. Never rotate the encryption key without following n8n's credential-migration process because it encrypts stored credentials.

## 5. Configure Supabase

1. Create a production project in the region closest to most users. Store its database password in a password manager.
2. In **Project Settings > General**, copy the project reference from the project URL if needed.
3. In **Project Settings > API** or **API Keys**, copy the project URL for `SUPABASE_URL`.
4. Create/copy a server-side **secret** key if available; otherwise copy the legacy `service_role` key. Store it as `SUPABASE_SERVICE_ROLE_KEY`. Despite the variable name, a current Supabase secret key is preferred. Never expose it through a `NEXT_PUBLIC_*` variable.
5. Link and migrate the project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

The dry run should list `supabase/migrations/202608260001_initial_schema.sql`. After the push, local and remote migration lists should agree.

6. In **Table Editor**, confirm these tables exist: `leads`, `lead_submissions`, `qualification_results`, `activities`, `workflow_runs`, `follow_ups`, and `outbound_drafts`.
7. Confirm Row Level Security is enabled and no `anon` or `authenticated` policies were added. V1 uses only the server-side key.

If linking prompts for the database password, use the one created with the Supabase project. Do not save it in a committed script.

Official reference: [Supabase CLI](https://supabase.com/docs/reference/cli/supabase-db-push).

## 6. Configure OpenAI

1. In the OpenAI API Platform, create or select a dedicated project for this application.
2. Enable billing/add credits and configure project usage limits and alerts for the expected volume.
3. Create a project API key and save it once. Add it to an n8n OpenAI credential; do not store it in Vercel, Railway environment variables, Slack, source code, or a browser variable.
4. Connect that credential to **OpenAI Chat Model** in the imported workflow. The workflow defaults to `gpt-5-mini`. If unavailable, choose a compatible model in the node and run the smoke test below.

With `AI_ANALYSIS_ENABLED=false`, the application completes deterministic qualification and n8n skips the Agent branch. If analysis is enabled without a working credential, the failure path retains the submission and routes it safely for human review. A successful deployment alone does not prove OpenAI is active; inspect the smoke-test result for AI-backed processing.

Official references: [OpenAI quickstart](https://platform.openai.com/docs/quickstart) and [API authentication](https://platform.openai.com/docs/api-reference/authentication).

## 7. Configure Slack (optional)

Skip this section and leave the Slack workflow node disabled if notifications are not required.

1. In Slack app management, choose **Create New App > From scratch**.
2. Select the production workspace and name the app.
3. Open **Incoming Webhooks** and enable them.
4. Select **Add New Webhook to Workspace**, choose a private operations channel, and authorize. Join a private channel first if it is not listed.
5. Copy the `https://hooks.slack.com/services/...` URL and store it as `SLACK_WEBHOOK_URL` on Railway.
6. Test it from a trusted terminal:

```bash
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H 'content-type: application/json' \
  --data '{"text":"AI lead qualification deployment test"}'
```

The message must appear in the selected channel. Treat the URL as a password; Slack can revoke leaked webhooks.

Official reference: [Slack incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/).

## 8. Deploy the application to Vercel

1. In Vercel, choose **Add New > Project** and import this GitHub repository.
2. Keep **Next.js** as the framework, the repository root as Root Directory, and detected install/build commands.
3. Under **Project Settings > Environment Variables**, add these values to **Production**. Use separate resources and secrets if you later enable Preview.

| Variable                    | Production value                       | Secret? |
| --------------------------- | -------------------------------------- | ------- |
| `DATA_MODE`                 | `supabase`                             | No      |
| `NEXT_PUBLIC_DEMO_MODE`     | `false`                                | No      |
| `AI_ANALYSIS_ENABLED`       | `false` (set `true` only when desired) | No      |
| `SUPABASE_URL`              | Supabase project URL                   | No      |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret/service-role key       | Yes     |
| `N8N_SHARED_SECRET`         | First generated 64-character hex value | Yes     |

Do not set `SLACK_WEBHOOK_URL` on Vercel. Do not put any secret in a `NEXT_PUBLIC_*` variable.

4. Deploy. Copy the assigned HTTPS production origin without a trailing slash, such as `https://your-project.vercel.app`.
5. Add that origin as Vercel's `APP_BASE_URL`, then redeploy so it exists in the running deployment.
6. Verify the root URL renders. Do not submit yet because n8n is not connected.

Official references: [Vercel Git deployments](https://vercel.com/docs/deployments/git) and [environment variables](https://vercel.com/docs/environment-variables).

## 9. Deploy n8n to Railway

1. Create an empty Railway project.
2. Add a service from Docker image `n8nio/n8n:latest`. After the first successful deployment, record and pin a tested n8n version so major upgrades are deliberate.
3. Under **Volumes**, add persistent storage mounted at `/home/node/.n8n` (1 GB is a reasonable start). Without it, users, workflows, credentials, and SQLite data disappear on redeploy.
4. Under **Networking**, generate a public Railway domain and copy its HTTPS origin without a trailing slash, for example `https://lead-automation-production.up.railway.app`.
5. Add these service variables:

| Variable              | Value                                      |
| --------------------- | ------------------------------------------ |
| `N8N_HOST`            | Railway hostname only, without `https://`  |
| `N8N_PROTOCOL`        | `https`                                    |
| `N8N_PORT`            | `5678`                                     |
| `WEBHOOK_URL`         | Railway HTTPS origin plus trailing slash   |
| `N8N_EDITOR_BASE_URL` | Railway HTTPS origin plus trailing slash   |
| `N8N_PROXY_HOPS`      | `1`                                        |
| `N8N_ENCRYPTION_KEY`  | Second generated secret                    |
| `GENERIC_TIMEZONE`    | Deployment timezone, e.g. `Asia/Karachi`   |
| `APP_BASE_URL`        | Vercel HTTPS origin, no trailing slash     |
| `N8N_SHARED_SECRET`   | Exact same value used on Vercel            |
| `SLACK_WEBHOOK_URL`   | Slack URL, or omit while Slack is disabled |

For the example origin, `N8N_HOST` is `lead-automation-production.up.railway.app`; `WEBHOOK_URL` and `N8N_EDITOR_BASE_URL` are `https://lead-automation-production.up.railway.app/`.

6. Redeploy. Open the domain and create the initial n8n owner account with a unique password. Do not invite application users; n8n is an administrative service.
7. Confirm the service is healthy and the volume is attached before importing workflows.

Official reference: [Railway self-host n8n guide](https://docs.railway.com/guides/n8n).

## 10. Import and activate n8n workflows

Use **Import from File** in n8n for `automation/n8n/workflows/ai-lead-qualification-follow-up.json`.

Confirm the workflow references `APP_BASE_URL`, `N8N_SHARED_SECRET`, and the optional `SLACK_WEBHOOK_URL`. On n8n Cloud, configure them as `$vars`; self-hosted n8n may supply the same names through `$env`. The expressions support either source. Connect the OpenAI credential to **OpenAI Chat Model**; the credential is intentionally absent from the portable JSON.

Activate **AI Lead Qualification & Follow-Up**. Its production intake URL is:

```text
https://YOUR_RAILWAY_DOMAIN/webhook/lead-intake
```

Never use `/webhook-test/` in Vercel; it only works while the n8n editor listens for a test event. The same published workflow retries persisted submissions every five minutes and processes due follow-ups hourly.

If Slack is configured, enable **Optional Slack notification**, save, and republish the workflow. Otherwise leave it disabled; processing still completes.

## 11. Complete cross-service wiring

Return to Vercel and add this Production variable:

| Variable          | Value                                             |
| ----------------- | ------------------------------------------------- |
| `N8N_WEBHOOK_URL` | `https://YOUR_RAILWAY_DOMAIN/webhook/lead-intake` |

Redeploy Vercel. Environment-variable changes do not affect an already-running deployment until redeployed.

Now Vercel knows Railway; Railway knows Vercel; both share `N8N_SHARED_SECRET`; Vercel holds only Supabase secrets; n8n's encrypted credential store holds the OpenAI key; and Railway holds the Slack webhook and n8n encryption key.

## 12. Production smoke test

### Browser test

1. Open the Vercel production root and submit a clearly fictional lead with a unique email.
2. The form should accept it rather than show an availability error.
3. In n8n **Executions**, confirm Lead Intake Processor ran without error.
4. Open Vercel `/dashboard` and confirm the record becomes `COMPLETED` (or an intentional review state) with a qualification result.
5. If Slack is enabled, confirm exactly one notification.

### API and idempotency test

Replace the origin and use a unique email/key for each genuinely new test:

```bash
curl -i -X POST 'https://YOUR_VERCEL_ORIGIN/api/leads' \
  -H 'content-type: application/json' \
  -H 'idempotency-key: production-smoke-test-001' \
  --data '{
    "contactName":"Production Test",
    "workEmail":"production-test-001@example.com",
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
    "currentChallenge":"This is a fictional production deployment verification submission.",
    "leadSource":"production_smoke_test",
    "timeline":"WITHIN_30_DAYS",
    "message":"No follow-up is required; this record is test data."
  }'
```

The first response should be HTTP `202` with `accepted: true`. Repeat the identical request with the identical idempotency key: it should return HTTP `200` and must not create a second submission or Slack notification.

In Supabase, verify one `lead_submissions` row, a related `qualification_results` row, and a `workflow_status` other than `PENDING_AUTOMATION`.

## 13. Troubleshooting

### `503 SUBMISSION_UNAVAILABLE`

- Confirm `DATA_MODE=supabase` and the two Supabase variables on the active Vercel Production deployment.
- Confirm the migration went to the same Supabase project used by Vercel.
- Inspect Vercel function logs.

### Record remains `PENDING_AUTOMATION`

- Confirm `N8N_WEBHOOK_URL` uses `/webhook/lead-intake`, not `/webhook-test/`.
- Confirm intake and recovery workflows are active.
- Confirm Railway `APP_BASE_URL` is the current Vercel origin.
- Confirm the shared secret matches byte-for-byte. A `401` from an internal Vercel endpoint means it does not.
- Inspect the failed n8n execution.

### No Slack message

- Confirm the Slack node is enabled, saved, and the workflow reactivated.
- Confirm Railway has the webhook and was redeployed.
- Repeat the standalone Slack test and check whether Slack revoked an exposed URL.

### AI always uses fallback

- Confirm the OpenAI credential is connected to **OpenAI Chat Model** and the selected model is available, then republish the workflow.
- Check OpenAI billing, project limits/usage, model access, and Vercel logs.

### n8n data disappears

The volume is absent or incorrectly mounted. Restore from backup and mount persistent storage at `/home/node/.n8n` before continuing.

## 14. Custom domain and external access

1. Add the user-facing domain under **Vercel > Project > Settings > Domains** and configure the displayed DNS records.
2. Wait for HTTPS and verify the domain.
3. Change Railway `APP_BASE_URL` and Vercel `APP_BASE_URL` to the final application origin.
4. Redeploy both services and repeat the smoke test.

Share only the Vercel application URL with users. The Railway n8n URL is infrastructure and should be limited to operators.

## 15. Production checklist

- [ ] `pnpm check` passes on the deployed commit.
- [ ] Supabase migrations match the repository.
- [ ] RLS is enabled with no anonymous policies.
- [ ] Vercel secrets exist only in environments that need them.
- [ ] Railway has a persistent `/home/node/.n8n` volume.
- [ ] `N8N_SHARED_SECRET` matches on Vercel and Railway.
- [ ] All workflows are imported and required workflows are active.
- [ ] Production intake uses `/webhook/lead-intake`.
- [ ] Fictional submission and idempotency replay tests pass.
- [ ] Slack succeeds if enabled.
- [ ] `/dashboard` is protected before real personal data is collected.
- [ ] OpenAI and provider billing alerts/limits are configured.
- [ ] A named operator owns backups, secret rotation, failed executions, and upgrades.

For normal releases, merge only after CI succeeds. Vercel deploys the production branch automatically; Supabase migrations and n8n workflow imports remain explicit operator steps and must precede code that depends on them.
