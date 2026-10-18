import crypto from 'node:crypto';

const cookieName = 'google_signup_profile';

function signature(value) {
  if (!process.env.SESSION_SECRET) throw new Error('Signup signing is not configured');
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('base64url');
}

export function issueGoogleSignupCookie(profile) {
  const payload = Buffer.from(JSON.stringify({
    email: profile.email.toLowerCase(),
    fullName: String(profile.name || profile.given_name || '').trim().slice(0, 120),
    expiresAt: Date.now() + 10 * 60 * 1000
  })).toString('base64url');
  return `${cookieName}=${payload}.${signature(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

export function readGoogleSignupProfile(req) {
  const raw = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!raw) return null;
  const [payload, providedSignature] = raw.split('.');
  if (!payload || !providedSignature) throw new Error('Google signup session is invalid');
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(providedSignature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw new Error('Google signup session is invalid');
  const profile = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!profile.email || profile.expiresAt < Date.now()) throw new Error('Google signup session expired');
  return profile;
}

export const clearGoogleSignupCookie = `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
