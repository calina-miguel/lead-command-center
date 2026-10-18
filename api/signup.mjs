import crypto from 'node:crypto';
import { sql, hashPassword, json, method } from './_lib/security.mjs';
import { clearGoogleSignupCookie, readGoogleSignupProfile } from './_lib/signup.mjs';

const roles = new Set(['Agent', 'Marketing', 'Operations', 'Owner', 'Other']);
const clean = (value, max) => String(value || '').trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function sendVerificationEmail({ email, fullName, token }) {
  const { RESEND_API_KEY, EMAIL_FROM, APP_ORIGIN } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM || !APP_ORIGIN) throw Object.assign(new Error('Email verification is not configured'), { statusCode: 503, publicMessage: 'Account setup is temporarily unavailable. Please contact the workspace administrator.' });
  const verificationUrl = new URL('/api/signup/verify', APP_ORIGIN);
  verificationUrl.searchParams.set('token', token);
  const safeName = escapeHtml(fullName);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email],
      subject: 'Confirm your Black Glove Marketing account',
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#171c25"><h1>Confirm your email</h1><p>Hi ${safeName},</p><p>Confirm your email to finish setting up your Black Glove Marketing account.</p><p><a href="${verificationUrl.href}" style="display:inline-block;padding:12px 20px;background:#007aff;color:#fff;text-decoration:none;border-radius:8px">Confirm email</a></p><p>This link expires in 30 minutes. If you did not request this account, you can ignore this message.</p></div>`,
      text: `Hi ${fullName},\n\nConfirm your email to finish setting up your Black Glove Marketing account: ${verificationUrl.href}\n\nThis link expires in 30 minutes. If you did not request this account, you can ignore this message.`
    })
  });
  if (!response.ok) throw Object.assign(new Error('Unable to send verification email'), { statusCode: 502, publicMessage: 'We could not send your confirmation email. Please try again shortly.' });
}

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const fullName = clean(req.body?.fullName, 120);
    const email = clean(req.body?.email, 254).toLowerCase();
    const companyName = clean(req.body?.companyName, 160);
    const projectTitle = clean(req.body?.projectTitle, 160);
    const businessRole = clean(req.body?.businessRole, 40);
    const username = clean(req.body?.username, 32);
    const password = String(req.body?.password || '');

    if (!fullName || !email || !companyName || !projectTitle || !businessRole || !username || !password) return json(res, 400, { error: 'Complete every field to continue.' });
    if (!emailPattern.test(email)) return json(res, 400, { error: 'Enter a valid email address.' });
    if (!roles.has(businessRole)) return json(res, 400, { error: 'Choose a valid role.' });
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) return json(res, 400, { error: 'Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens.' });
    if (password.length < 12 || password.length > 128) return json(res, 400, { error: 'Use a password between 12 and 128 characters.' });

    let googleProfile;
    try { googleProfile = readGoogleSignupProfile(req); } catch { return json(res, 400, { error: 'Your Google signup session expired. Start Google signup again.' }); }
    if (googleProfile && googleProfile.email !== email) return json(res, 400, { error: 'Use the same email address you selected with Google.' });
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_ORIGIN) return json(res, 503, { error: 'Account setup is temporarily unavailable. Please contact the workspace administrator.' });

    const existing = await sql`select email, username from users where lower(email) = ${email} or lower(username) = lower(${username}) limit 1`;
    if (existing.length) return json(res, 409, { error: 'That email or username is already in use. Sign in or choose another.' });
    const pending = await sql`select email from pending_signups where lower(username) = lower(${username}) and lower(email) <> ${email} limit 1`;
    if (pending.length) return json(res, 409, { error: 'That username is already being used. Choose another.' });

    const token = crypto.randomBytes(32).toString('base64url');
    const passwordHash = await hashPassword(password);
    await sql`insert into pending_signups (email, username, full_name, company_name, project_title, business_role, password_hash, verification_token_hash, expires_at)
      values (${email}, ${username}, ${fullName}, ${companyName}, ${projectTitle}, ${businessRole}, ${passwordHash}, ${hashToken(token)}, now() + interval '30 minutes')
      on conflict (email) do update set username = excluded.username, full_name = excluded.full_name, company_name = excluded.company_name, project_title = excluded.project_title, business_role = excluded.business_role, password_hash = excluded.password_hash, verification_token_hash = excluded.verification_token_hash, expires_at = excluded.expires_at, created_at = now()`;
    await sendVerificationEmail({ email, fullName, token });
    if (googleProfile) res.setHeader('Set-Cookie', clearGoogleSignupCookie);
    return json(res, 202, { message: 'Check your email for a confirmation link to finish creating your account.' });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.publicMessage || 'Unable to start account setup right now.' });
  }
}
