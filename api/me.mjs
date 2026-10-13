import { requireUser, json, method } from './_lib/security.mjs';
export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try { const user = await requireUser(req); return json(res, 200, { user }); }
  catch (error) { return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Session service unavailable' }); }
}
