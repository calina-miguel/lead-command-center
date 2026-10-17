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

create index if not exists lead_folder_overrides_updated_at_idx on lead_folder_overrides(user_id, updated_at desc);
