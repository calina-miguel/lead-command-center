import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const sql = neon(process.env.DATABASE_URL);
const baseTables = await sql.query("select to_regclass('public.users') as users", []);
if (!baseTables[0]?.users) throw new Error('The base users table is missing; migration was not started.');

const migrationNames = ['20261016_approval_and_test_sync.sql', '20261017_lead_routing.sql', '20261018_account_onboarding.sql'];
let statementsApplied = 0;
for (const name of migrationNames) {
  const migrationPath = new URL(`../db/migrations/${name}`, import.meta.url);
  const migration = await readFile(fileURLToPath(migrationPath), 'utf8');
  const statements = migration.split(';').map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement, []);
  statementsApplied += statements.length;
}

const tables = await sql.query(
  "select to_regclass('public.approvals') as approvals, to_regclass('public.sync_jobs') as sync_jobs, to_regclass('public.test_leads') as test_leads, to_regclass('public.lead_routing_preferences') as preferences, to_regclass('public.lead_folder_overrides') as overrides, to_regclass('public.pending_signups') as pending_signups",
  []
);
if (!tables[0]?.approvals || !tables[0]?.sync_jobs || !tables[0]?.test_leads || !tables[0]?.preferences || !tables[0]?.overrides || !tables[0]?.pending_signups) {
  throw new Error('Migration ran, but required table verification failed.');
}

console.log(JSON.stringify({ migrations: migrationNames, statementsApplied, verifiedTables: ['approvals', 'sync_jobs', 'test_leads', 'lead_routing_preferences', 'lead_folder_overrides', 'pending_signups'] }));
