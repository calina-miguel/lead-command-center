import crypto from 'node:crypto';
import { sql, issueSessionCookie, tokenHash } from '../../_lib/security.mjs';
import { issueGoogleSignupCookie } from '../../_lib/signup.mjs';

const workspacePath = '/marketing/workspace.html';
const loginPath = '/marketing/';
const canonicalOAuthHost = 'black-glove-systems.vercel.app';
const legacyOAuthHosts = new Set([
  'blackglovemarketing.vercel.app',
  'black-glove-marketing-admin.vercel.app',
  'lead-command-center-phi.vercel.app'
]);
const readCookie = (req, name) => (req.headers.cookie || '').split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1];
const clearOAuthCookie = 'google_oauth_state=; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
const clearOAuthModeCookie = 'google_oauth_mode=; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
const readOAuthCookie = (req, name) => (req.headers.cookie || '').split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1];

function redirect(res, path) {
  res.setHeader('Set-Cookie', [clearOAuthCookie, clearOAuthModeCookie, ...(res.getHeader('Set-Cookie') ? [res.getHeader('Set-Cookie')] : [])]);
  res.statusCode = 302;
  res.setHeader('Location', path);
  res.end();
}

export default async function handler(req, res) {
  try {
    const requestHost = String(req.headers.host || '').split(':')[0].toLowerCase();
    if (legacyOAuthHosts.has(requestHost)) {
      const callbackUrl = new URL(req.url, `https://${requestHost}`);
      res.statusCode = 302;
      res.setHeader('Location', `https://${canonicalOAuthHost}${callbackUrl.pathname}${callbackUrl.search}`);
      return res.end();
    }

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
    const mode = readOAuthCookie(req, 'google_oauth_mode') === 'signup' ? 'signup' : 'signin';
    if (mode === 'signup') {
      const rows = await sql`select 1 from users where lower(email) = lower(${email}) limit 1`;
      if (rows.length) return redirect(res, `${loginPath}?signup=exists`);
      res.setHeader('Set-Cookie', [clearOAuthCookie, clearOAuthModeCookie, issueGoogleSignupCookie({ ...profile, name: displayName })]);
      res.statusCode = 302;
      res.setHeader('Location', `${loginPath}?signup=google`);
      return res.end();
    }

    const rows = await sql`select id, email, username, role from users where lower(email) = lower(${email}) limit 1`;
    const user = rows[0];
    if (!user) {
      res.setHeader('Set-Cookie', [clearOAuthCookie, clearOAuthModeCookie, issueGoogleSignupCookie({ ...profile, name: displayName })]);
      res.statusCode = 302;
      res.setHeader('Location', `${loginPath}?signup=google`);
      return res.end();
    }
    const sessionToken = Buffer.from(`${user.id}:${crypto.randomUUID()}:${Date.now()}`).toString('base64url');
    await sql`insert into sessions (user_id, token_hash, expires_at) values (${user.id}, ${tokenHash(sessionToken)}, now() + interval '7 days')`;
    res.setHeader('Set-Cookie', [clearOAuthCookie, clearOAuthModeCookie, issueSessionCookie(sessionToken)]);
    res.statusCode = 302;
    res.setHeader('Location', workspacePath);
    return res.end();
  } catch {
    return redirect(res, `${loginPath}?google=error`);
  }
}
