import { requireUser, json, method } from './_lib/security.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try { return json(res, 200, { user: await requireUser(req) }); }
  catch (error) { return json(res, error.statusCode || 401, { error: 'Authentication required' }); }
}
