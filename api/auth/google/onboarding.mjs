import { json, method } from '../../_lib/security.mjs';
import { readGoogleSignupProfile } from '../../_lib/signup.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    const profile = readGoogleSignupProfile(req);
    if (!profile) return json(res, 404, { error: 'No Google signup profile is waiting.' });
    return json(res, 200, { email: profile.email, fullName: profile.fullName });
  } catch {
    return json(res, 401, { error: 'Your Google signup session expired. Start Google signup again.' });
  }
}
