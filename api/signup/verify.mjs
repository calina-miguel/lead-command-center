import { json, method } from '../_lib/security.mjs';
import { applyFirebaseVerification } from '../_lib/firebase-auth.mjs';
import { activatePendingSignup } from '../_lib/activate-signup.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const oobCode = String(req.body?.oobCode || '');
    if (oobCode.length < 20 || oobCode.length > 4096) return json(res, 400, { error: 'That confirmation link is not valid. Request a new one.' });
    const verified = await applyFirebaseVerification(oobCode);
    if (!verified.email || verified.emailVerified !== true) return json(res, 400, { error: 'Email confirmation could not be completed. Request a new link.' });
    const activated = await activatePendingSignup(verified.email, verified.idToken, res);
    if (activated.error) return json(res, activated.status, { error: activated.error });
    return json(res, 200, { message: 'Email confirmed. Your account is ready.', redirect: '/marketing/workspace.html' });
  } catch (error) {
    const status = error.statusCode === 400 ? 400 : error.statusCode === 503 ? 503 : 502;
    return json(res, status, { error: status === 400 ? 'That confirmation link has expired or was already used. Request a new one.' : 'We could not finish account setup. Please try again shortly.' });
  }
}
