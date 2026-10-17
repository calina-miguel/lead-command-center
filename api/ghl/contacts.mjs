import { requireUser, ghlHeaders, json, method } from '../_lib/security.mjs';
import { classifyLead } from '../_lib/lead-policy.mjs';

const base = 'https://services.leadconnectorhq.com';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    await requireUser(req, { admin: true });
    const locationId = process.env.GHL_LOCATION_ID;
    if (!locationId) return json(res, 503, { error: 'HighLevel location is not configured' });

    const params = new URL(req.url, 'http://localhost').searchParams;
    const limit = Math.max(1, Math.min(Number(params.get('limit')) || 50, 100));
    const page = Math.max(1, Math.min(Number(params.get('page')) || 1, 100));
    // Search Contacts is HighLevel's supported read endpoint. This retrieves bounded pages and never mutates CRM records.
    const response = await fetch(`${base}/contacts/search`, {
      method: 'POST',
      headers: { ...ghlHeaders(), Version: 'v3', 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, page, pageLimit: limit, sort: [{ field: 'dateAdded', direction: 'desc' }] })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return json(res, response.status, { error: 'Unable to import contacts from HighLevel' });

    const contacts = Array.isArray(body.contacts) ? body.contacts : [];
    const leads = contacts.map((contact) => ({
      crm: 'highlevel',
      id: String(contact.id || ''),
      name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || 'Unnamed lead',
      source: contact.source || 'HighLevel',
      status: contact.status || contact.lifecycleStage || 'Not provided by CRM',
      tags: Array.isArray(contact.tags) ? contact.tags : [],
      category: classifyLead(contact),
      dnd: contact.dnd === true,
      dateAdded: contact.dateAdded || null
    })).filter((lead) => lead.id);
    const total = Number(body.total ?? body.count ?? leads.length);
    const nextPage = leads.length === limit && page * limit < total ? page + 1 : null;
    return json(res, 200, { source: 'HighLevel', count: total, leads, nextPage });
  } catch (error) {
    return json(res, error.statusCode || 502, { error: error.statusCode ? error.message : 'HighLevel contact import unavailable' });
  }
}
