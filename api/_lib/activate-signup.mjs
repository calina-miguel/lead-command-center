import crypto from 'node:crypto';
import { sql, issueSessionCookie, tokenHash } from './security.mjs';
import { clearGoogleSignupCookie } from './signup.mjs';
import { deleteFirebaseSignup } from './firebase-auth.mjs';

export async function activatePendingSignup(email, firebaseIdToken, res) {
  const pending = await sql`select email, username, full_name, company_name, project_title, business_role, password_hash from pending_signups where lower(email) = lower(${email}) and expires_at > now() limit 1`;
  if (!pending.length) return { error: 'This signup has expired. Please submit the form again.', status: 410 };

  const signup = pending[0];
  const users = await sql`insert into users (email, username, password_hash, role, full_name, company_name, project_title, business_role)
    values (${signup.email}, ${signup.username}, ${signup.password_hash}, 'member', ${signup.full_name}, ${signup.company_name}, ${signup.project_title}, ${signup.business_role})
    on conflict (email) do nothing returning id, email`;
  if (!users.length) {
    await sql`delete from pending_signups where email = ${signup.email}`;
    return { error: 'An account already exists for this email. Please sign in.', status: 409 };
  }

  await sql`delete from pending_signups where email = ${signup.email}`;
  const session = Buffer.from(`${users[0].id}:${crypto.randomUUID()}:${Date.now()}`).toString('base64url');
  await sql`insert into sessions (user_id, token_hash, expires_at) values (${users[0].id}, ${tokenHash(session)}, now() + interval '7 days')`;
  res.setHeader('Set-Cookie', [clearGoogleSignupCookie, issueSessionCookie(session)]);
  if (firebaseIdToken) deleteFirebaseSignup(firebaseIdToken).catch(() => {});
  return { user: users[0] };
}
