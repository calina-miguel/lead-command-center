import crypto from 'node:crypto';
import { sql, hashPassword, verifyPassword, issueSessionCookie, tokenHash, json, method } from './_lib/security.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const { email, username, password } = req.body || {};
    const identifier = email || username;
    if (!identifier || !password) return json(res, 400, { error: 'Username or email and password are required' });
    const rows = await sql`select id, email, username, password_hash, role from users where lower(email) = lower(${identifier}) or lower(username) = lower(${identifier}) limit 1`;
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) return json(res, 401, { error: 'Invalid credentials' });
    const rawToken = btoa(`${user.id}:${crypto.randomUUID()}:${Date.now()}`);
    await sql`insert into sessions (user_id, token_hash, expires_at) values (${user.id}, ${tokenHash(rawToken)}, now() + interval '7 days')`;
    res.setHeader('Set-Cookie', issueSessionCookie(rawToken));
    return json(res, 200, { user: { email: user.email, username: user.username, role: user.role } });
  } catch (error) { return json(res, 500, { error: 'Login service unavailable' }); }
}
