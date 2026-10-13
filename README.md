# Lead Command Center

Lead Command Center is a client-facing SaaS workspace for lead intake, priority response handling, content approval, pipeline visibility, and revenue handoff operations.

## Features

- Lead intake overview
- Hot lead priority inbox
- Content approval queue
- Revenue pipeline board
- Automation engine walkthrough
- Light and dark mode
- Responsive iOS-inspired interface

## Local Preview

Serve the `docs` directory with any static server.

```bash
python -m http.server 5178 --directory docs
```

## Secure Vercel layer

The GitHub Pages experience remains static and keeps its existing URLs. The secure Vercel layer lives beside it and provides database-backed sessions, admin roles, audit logs, and server-side HighLevel proxy routes. Copy `.env.example` to the Vercel project environment, run `db/schema.sql` against the provisioned Postgres database, then seed administrators with `node scripts/seed-admins.mjs` using environment variables only.

