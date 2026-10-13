import { sql, hashPassword } from '../api/_lib/security.mjs';

const entries = [
  { email: process.env.ADMIN_EMAIL_1, password: process.env.ADMIN_PASSWORD_1 },
  { email: process.env.ADMIN_EMAIL_2, password: process.env.ADMIN_PASSWORD_2 }
];

for (const entry of entries) {
  if (!entry.email || !entry.password) throw new Error('Set ADMIN_EMAIL_1/2 and ADMIN_PASSWORD_1/2 in the server environment before seeding.');
  await sql`insert into users (email, password_hash, role) values (${entry.email.toLowerCase()}, ${await hashPassword(entry.password)}, 'admin') on conflict (email) do update set password_hash = excluded.password_hash, role = 'admin'`;
}
console.log('Admin users seeded.');
