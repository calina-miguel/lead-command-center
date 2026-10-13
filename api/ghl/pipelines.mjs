import { requireUser, audit, ghlHeaders, json, method } from '../_lib/security.mjs';
const base = 'https://services.leadconnectorhq.com';
export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST', 'PUT'])) return;
  try {
    const user = await requireUser(req, { admin: true });
    const locationId = process.env.GHL_LOCATION_ID;
    const url = `${base}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`;
    const response = await fetch(url, { method: req.method === 'GET' ? 'GET' : req.method, headers: ghlHeaders(), body: req.method === 'GET' ? undefined : JSON.stringify(req.body || {}) });
    const payload = await response.json();
    await audit(user, `ghl.pipelines.${req.method.toLowerCase()}`, 'pipelines', { ok: response.ok });
    return json(res, response.status, payload);
  } catch (error) { return json(res, error.statusCode || 502, { error: error.statusCode ? error.message : 'GHL pipeline service unavailable' }); }
}
