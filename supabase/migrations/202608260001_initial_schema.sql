create extension if not exists pgcrypto;

create type public.workflow_status as enum ('PENDING_AUTOMATION', 'PROCESSING', 'COMPLETED', 'RETRYABLE_FAILURE', 'HUMAN_REVIEW');
create type public.follow_up_status as enum ('SCHEDULED', 'DRAFTED', 'CANCELLED', 'FAILED');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null unique,
  company_name text not null,
  current_status text not null default 'NEW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_email_idx on public.leads (lower(normalized_email));

create table public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  idempotency_key text not null unique,
  raw_payload jsonb not null,
  normalized_payload jsonb not null,
  workflow_status public.workflow_status not null default 'PENDING_AUTOMATION',
  attempts integer not null default 0 check (attempts >= 0),
  qualification_result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_submissions_pending_idx on public.lead_submissions (workflow_status, created_at);
create index lead_submissions_email_idx on public.lead_submissions ((lower(normalized_payload ->> 'workEmail')));

create table public.qualification_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.lead_submissions(id),
  version text not null,
  classification text not null,
  score integer check (score between 0 and 100),
  result jsonb not null,
  prompt_version text,
  model text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now(),
  unique (submission_id, version)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  submission_id uuid references public.lead_submissions(id),
  event_type text not null,
  actor_type text not null check (actor_type in ('SYSTEM', 'HUMAN', 'INTEGRATION')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activities_lead_created_idx on public.activities (lead_id, created_at desc);

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.lead_submissions(id),
  provider_run_id text,
  status public.workflow_status not null,
  attempt integer not null check (attempt > 0),
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  submission_id uuid not null references public.lead_submissions(id),
  sequence text not null,
  checkpoint text not null check (checkpoint in ('T24H', 'T72H', 'T7D')),
  due_at timestamptz not null,
  status public.follow_up_status not null default 'SCHEDULED',
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, sequence, checkpoint)
);
create index follow_ups_due_idx on public.follow_ups (status, due_at);

create table public.outbound_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  submission_id uuid not null references public.lead_submissions(id),
  channel text not null check (channel in ('EMAIL', 'SLACK')),
  subject text,
  body text not null,
  generated_by text not null,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
alter table public.lead_submissions enable row level security;
alter table public.qualification_results enable row level security;
alter table public.activities enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.follow_ups enable row level security;
alter table public.outbound_drafts enable row level security;

comment on schema public is 'No anonymous policies are defined. All V1 access is server-side through the service role.';
