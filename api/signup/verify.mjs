import { json, method } from '../_lib/security.mjs';
import { signInFirebaseSignup } from '../_lib/firebase-auth.mjs';
import { activatePendingSignup } from '../_lib/activate-signup.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
      return json(res, 400, { error: 'Enter the email and password used to create your account.' });
    }
    let account;
    try { account = await signInFirebaseSignup({ email, password }); }
    catch (error) {
      if (error.statusCode === 400) return json(res, 401, { error: 'That email and password do not match. Use the credentials from signup.' });
      throw error;
    }
    if (!account.emailVerified) return json(res, 409, { error: 'Confirm your email from the Firebase message first, then return here.' });
    const activated = await activatePendingSignup(email, account.idToken, res);
    if (activated.error) return json(res, activated.status, { error: activated.error });
    return json(res, 200, { message: 'Email confirmed. Your account is ready.', redirect: '/marketing/workspace.html' });
  } catch (error) {
    const status = error.statusCode === 503 ? 503 : 502;
    return json(res, status, { error: 'We could not finish account setup. Please try again shortly.' });
  }
}
