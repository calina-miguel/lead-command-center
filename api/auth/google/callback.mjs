import crypto from 'node:crypto';
import { sql, hashPassword, issueSessionCookie, tokenHash } from '../../_lib/security.mjs';

const workspacePath = '/marketing/workspace.html';
const loginPath = '/marketing/';
const readCookie = (req, name) => (req.headers.cookie || '').split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1];
const clearOAuthCookie = 'google_oauth_state=; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

function redirect(res, path) {
  res.setHeader('Set-Cookie', [clearOAuthCookie, ...(res.getHeader('Set-Cookie') ? [res.getHeader('Set-Cookie')] : [])]);
  res.statusCode = 302;
  res.setHeader('Location', path);
  res.end();
}

export default async function handler(req, res) {
  try {
    const { code, state, error } = req.query || {};
    if (error || !code || !state || state !== readCookie(req, 'google_oauth_state')) return redirect(res, `${loginPath}?google=cancelled`);
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) throw new Error('OAuth is not configured');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code', code })
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) throw new Error('OAuth token exchange failed');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email || profile.email_verified !== true) throw new Error('Verified Google account unavailable');

    const email = profile.email.toLowerCase();
    const displayName = (profile.name || profile.given_name || email.split('@')[0]).trim().slice(0, 80);
    let rows = await sql`select id, email, username, role from users where lower(email) = lower(${email}) limit 1`;
    let user = rows[0];
    if (!user) {
      const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
      const baseUsername = email.split('@')[0].slice(0, 70);
      const existing = await sql`select 1 from users where lower(username) = lower(${baseUsername}) limit 1`;
      const username = existing.length ? `${baseUsername}-${crypto.randomBytes(3).toString('hex')}` : baseUsername;
      rows = await sql`insert into users (email, username, password_hash, role) values (${email}, ${username}, ${passwordHash}, 'member') returning id, email, username, role`;
      user = rows[0];
    } else if (!user.username) {
      const conflict = await sql`select 1 from users where lower(username) = lower(${displayName}) limit 1`;
      if (!conflict.length) {
        rows = await sql`update users set username = ${displayName} where id = ${user.id} returning id, email, username, role`;
        user = rows[0];
      }
    }
    const sessionToken = Buffer.from(`${user.id}:${crypto.randomUUID()}:${Date.now()}`).toString('base64url');
    await sql`insert into sessions (user_id, token_hash, expires_at) values (${user.id}, ${tokenHash(sessionToken)}, now() + interval '7 days')`;
    res.setHeader('Set-Cookie', [clearOAuthCookie, issueSessionCookie(sessionToken)]);
    res.statusCode = 302;
    res.setHeader('Location', workspacePath);
    return res.end();
  } catch {
    return redirect(res, `${loginPath}?google=error`);
  }
}
