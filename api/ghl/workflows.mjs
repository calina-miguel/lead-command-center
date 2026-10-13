import { requireUser, audit, ghlHeaders, json, method } from '../_lib/security.mjs';
const base = 'https://services.leadconnectorhq.com';
export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'PUT', 'POST'])) return;
  try {
    const user = await requireUser(req, { admin: true });
    const query = new URL(req.url, 'http://localhost').search;
    const response = await fetch(`${base}/workflows/${query}`, { method: req.method, headers: ghlHeaders(), body: req.method === 'GET' ? undefined : JSON.stringify(req.body || {}) });
    const payload = await response.json();
    await audit(user, `ghl.workflows.${req.method.toLowerCase()}`, 'workflows', { ok: response.ok });
    return json(res, response.status, payload);
  } catch (error) { return json(res, error.statusCode || 502, { error: error.statusCode ? error.message : 'GHL workflow service unavailable' }); }
}
