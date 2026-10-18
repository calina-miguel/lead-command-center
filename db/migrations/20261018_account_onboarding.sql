alter table users add column if not exists full_name text;
alter table users add column if not exists company_name text;
alter table users add column if not exists project_title text;
alter table users add column if not exists business_role text;

create table if not exists pending_signups (
  email text primary key,
  username text not null unique,
  full_name text not null,
  company_name text not null,
  project_title text not null,
  business_role text not null,
  password_hash text not null,
  verification_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists pending_signups_expiry_idx on pending_signups(expires_at);
