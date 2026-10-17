create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references users(id),
  approved_by uuid references users(id),
  kind text not null check (kind in ('content', 'sync', 'workflow')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists sync_jobs (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references approvals(id),
  requested_by uuid not null references users(id),
  destination text not null check (destination in ('highlevel', 'boldtrail')),
  status text not null check (status in ('dry_run', 'running', 'completed', 'rejected', 'failed')),
  execution_key text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table sync_jobs add column if not exists execution_key text;
alter table sync_jobs drop constraint if exists sync_jobs_status_check;
alter table sync_jobs add constraint sync_jobs_status_check check (status in ('dry_run', 'running', 'completed', 'rejected', 'failed'));

create table if not exists test_leads (
  id uuid primary key default gen_random_uuid(),
  crm text not null check (crm in ('highlevel', 'boldtrail')),
  external_id text not null,
  label text not null default 'Approved test lead',
  registered_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (crm, external_id)
);

create index if not exists approvals_status_created_at_idx on approvals(status, created_at desc);
create index if not exists sync_jobs_approval_created_at_idx on sync_jobs(approval_id, created_at desc);
create unique index if not exists sync_jobs_execution_key_idx on sync_jobs(execution_key) where execution_key is not null;
create index if not exists test_leads_crm_external_id_idx on test_leads(crm, external_id);
