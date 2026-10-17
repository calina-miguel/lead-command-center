create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create unique index if not exists users_username_lower_idx on users(lower(username)) where username is not null;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  action text not null,
  resource text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

create table if not exists test_leads (
  id uuid primary key default gen_random_uuid(),
  crm text not null check (crm in ('highlevel', 'boldtrail')),
  external_id text not null,
  label text not null default 'Approved test lead',
  registered_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique (crm, external_id)
);

create table if not exists lead_routing_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  campaign_path text not null check (campaign_path in ('outreach', 'agents')),
  lead_source text not null check (lead_source in ('boldtrail', 'highlevel', 'website', 'referrals')),
  default_destination text not null check (default_destination in ('highlevel', 'boldtrail', 'hubspot', 'salesforce')),
  selected_folder text not null check (selected_folder in ('cold', 'inquiring', 'warm', 'hot', 'closed', 'unclassified')),
  outcome text not null check (outcome in ('needs_reply', 'appointment', 'qualified', 'not_interested', 'do_not_contact')),
  outcome_folder text not null check (outcome_folder in ('inquiring', 'warm', 'hot', 'closed')),
  updated_at timestamptz not null default now()
);

create table if not exists lead_folder_overrides (
  user_id uuid not null references users(id) on delete cascade,
  crm text not null check (crm in ('highlevel', 'boldtrail')),
  external_id text not null,
  folder text not null check (folder in ('cold', 'inquiring', 'warm', 'hot', 'closed', 'unclassified')),
  updated_at timestamptz not null default now(),
  primary key (user_id, crm, external_id)
);

create index if not exists sessions_token_hash_idx on sessions(token_hash);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);
create index if not exists approvals_status_created_at_idx on approvals(status, created_at desc);
create index if not exists sync_jobs_approval_created_at_idx on sync_jobs(approval_id, created_at desc);
create unique index if not exists sync_jobs_execution_key_idx on sync_jobs(execution_key) where execution_key is not null;
create index if not exists test_leads_crm_external_id_idx on test_leads(crm, external_id);
create index if not exists lead_folder_overrides_updated_at_idx on lead_folder_overrides(user_id, updated_at desc);
