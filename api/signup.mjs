import crypto from 'node:crypto';
import { sql, hashPassword, json, method } from './_lib/security.mjs';
import { readGoogleSignupProfile } from './_lib/signup.mjs';
import { createOrResumeFirebaseSignup, sendFirebaseVerification } from './_lib/firebase-auth.mjs';
import { activatePendingSignup } from './_lib/activate-signup.mjs';

const roles = new Set(['Agent', 'Marketing', 'Operations', 'Owner', 'Other']);
const clean = (value, max) => String(value || '').trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
    if (!process.env.FIREBASE_WEB_API_KEY || !process.env.APP_ORIGIN) return json(res, 503, { error: 'Account setup is temporarily unavailable. Please contact the workspace administrator.' });

    const existing = await sql`select email, username from users where lower(email) = ${email} or lower(username) = lower(${username}) limit 1`;
    if (existing.length) return json(res, 409, { error: 'That email or username is already in use. Sign in or choose another.' });
    const pending = await sql`select email from pending_signups where lower(username) = lower(${username}) and lower(email) <> ${email} limit 1`;
    if (pending.length) return json(res, 409, { error: 'That username is already being used. Choose another.' });

    const firebaseAccount = await createOrResumeFirebaseSignup({ email, password });
    const passwordHash = await hashPassword(password);
    const pendingToken = crypto.randomBytes(32).toString('base64url');
    const pendingTokenHash = crypto.createHash('sha256').update(pendingToken).digest('hex');
    await sql`insert into pending_signups (email, username, full_name, company_name, project_title, business_role, password_hash, verification_token_hash, expires_at)
      values (${email}, ${username}, ${fullName}, ${companyName}, ${projectTitle}, ${businessRole}, ${passwordHash}, ${pendingTokenHash}, now() + interval '24 hours')
      on conflict (email) do update set username = excluded.username, full_name = excluded.full_name, company_name = excluded.company_name, project_title = excluded.project_title, business_role = excluded.business_role, password_hash = excluded.password_hash, verification_token_hash = excluded.verification_token_hash, expires_at = excluded.expires_at, created_at = now()`;

    if (firebaseAccount.emailVerified) {
      const activated = await activatePendingSignup(email, firebaseAccount.idToken, res);
      if (activated.error) return json(res, activated.status, { error: activated.error });
      return json(res, 200, { message: 'Email already verified. Your account is ready.', redirect: '/marketing/workspace.html' });
    }

    const continueUrl = new URL('/marketing/verify.html', process.env.APP_ORIGIN);
    await sendFirebaseVerification({ idToken: firebaseAccount.idToken, continueUrl: continueUrl.href });
    return json(res, 202, { message: 'Check your email for a confirmation link to finish creating your account.' });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.publicMessage || 'Unable to start account setup right now.' });
  }
}
