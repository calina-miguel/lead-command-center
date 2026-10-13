create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

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

create index if not exists sessions_token_hash_idx on sessions(token_hash);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);
