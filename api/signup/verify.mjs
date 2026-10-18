import crypto from 'node:crypto';
import { sql, issueSessionCookie, tokenHash } from '../_lib/security.mjs';
import { clearGoogleSignupCookie } from '../_lib/signup.mjs';

const loginPath = '/marketing/';
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');

export default async function handler(req, res) {
  try {
    const token = req.query?.token;
    if (req.method !== 'GET' || typeof token !== 'string' || token.length < 32 || token.length > 128) {
      res.statusCode = 302;
      res.setHeader('Location', `${loginPath}?signup=invalid`);
      return res.end();
    }
    const pending = await sql`select email, username, full_name, company_name, project_title, business_role, password_hash from pending_signups where verification_token_hash = ${digest(token)} and expires_at > now() limit 1`;
    if (!pending.length) {
      res.setHeader('Set-Cookie', clearGoogleSignupCookie);
      res.statusCode = 302;
      res.setHeader('Location', `${loginPath}?signup=expired`);
      return res.end();
    }
    const signup = pending[0];
    const users = await sql`insert into users (email, username, password_hash, role, full_name, company_name, project_title, business_role)
      values (${signup.email}, ${signup.username}, ${signup.password_hash}, 'member', ${signup.full_name}, ${signup.company_name}, ${signup.project_title}, ${signup.business_role})
      on conflict (email) do nothing returning id, email`;
    if (!users.length) {
      await sql`delete from pending_signups where email = ${signup.email}`;
      res.statusCode = 302;
      res.setHeader('Location', `${loginPath}?signup=exists`);
      return res.end();
    }
    await sql`delete from pending_signups where email = ${signup.email}`;
    const session = Buffer.from(`${users[0].id}:${crypto.randomUUID()}:${Date.now()}`).toString('base64url');
    await sql`insert into sessions (user_id, token_hash, expires_at) values (${users[0].id}, ${tokenHash(session)}, now() + interval '7 days')`;
    res.setHeader('Set-Cookie', [clearGoogleSignupCookie, issueSessionCookie(session)]);
    res.statusCode = 302;
    res.setHeader('Location', '/marketing/workspace.html');
    return res.end();
  } catch {
    res.setHeader('Set-Cookie', clearGoogleSignupCookie);
    res.statusCode = 302;
    res.setHeader('Location', `${loginPath}?signup=error`);
    return res.end();
  }
}
