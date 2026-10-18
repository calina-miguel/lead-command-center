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

## Production rollout

Production CRM sync is deliberately restricted to admin-approved records in the `test_leads` registry. The server looks up each record's current status immediately before writing; closed, client, archived, unknown, or unregistered records are rejected. Sync approval IDs are single-use. Firebase Authentication sends account verification emails on its no-cost tier; Neon remains the source of BGM profile, role, and app-session data. SMS and social posts are not sent by the app.

1. Apply the migrations in `db/migrations/` in date order in the Neon SQL editor (or apply the complete `db/schema.sql` to a new database).
2. Add the production variables in `.env.example` to the Vercel project's Production environment. For signup confirmation, create or select a Firebase project on the no-cost Spark plan, enable Email/Password sign-in, and add `black-glove-systems.vercel.app` as an authorized domain. Set `FIREBASE_WEB_API_KEY` to that project's Web API key and keep `APP_ORIGIN=https://black-glove-systems.vercel.app`. Firebase's built-in verification email handler confirms the address and links back to BGM; the user re-enters the signup email and password to finish activating the Neon profile. Use the matching production OAuth redirect URL in Google Cloud and set `GOOGLE_REDIRECT_URI` to `https://<production-domain>/api/auth/google/callback`.
3. Seed the two admin accounts from a trusted local shell with their unique admin passwords. Do not put admin passwords into a public/static build.
4. Add BoldTrail's private API token and Opus Clip's API key only after the account owner obtains them. Keep `BOLDTRAIL_STATUS_MAP_VERIFIED=false` until the account owner verifies BoldTrail's current API contract and status mapping with a dedicated test contact. The Opus route creates a clip project from a public HTTPS URL; it does not publish clips.
5. In the admin panel, register only a dedicated CRM test record, submit a sync approval, approve it, run the live dry-run, then explicitly run the test sync. Never register or sync closed leads or ordinary production contacts for QA.
6. Verify login, admin/member authorization, approvals, provider error handling, and the live deployment after Vercel finishes the production build.

Do not consider the deployment production-ready until the Neon migration, production environment variables, provider credentials, and the approved non-closed test workflow have all been verified against the live Vercel deployment.

