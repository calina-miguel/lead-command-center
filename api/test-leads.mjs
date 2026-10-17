import { requireUser, audit, json, method, sql } from './_lib/security.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try {
    const user = await requireUser(req, { admin: true });
    if (req.method === 'GET') {
      const rows = await sql`select crm, external_id, label, created_at from test_leads order by created_at desc limit 100`;
      return json(res, 200, { testLeads: rows });
    }
    const { crm, externalId, label } = req.body || {};
    if (!['highlevel', 'boldtrail'].includes(crm) || typeof externalId !== 'string' || !/^[\w-]{3,100}$/.test(externalId)) {
      return json(res, 400, { error: 'Choose a CRM and enter a valid test-record id' });
    }
    const safeLabel = String(label || 'Approved test lead').slice(0, 100);
    if (!safeLabel.toLowerCase().includes('test')) return json(res, 400, { error: 'Test-record labels must include “test”' });
    const rows = await sql`insert into test_leads (crm, external_id, label, registered_by)
      values (${crm}, ${externalId}, ${safeLabel}, ${user.id})
      on conflict (crm, external_id) do update set label = excluded.label returning crm, external_id, label, created_at`;
    await audit(user, 'crm.test_lead.registered', crm, { externalId });
    return json(res, 201, { testLead: rows[0] });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Test-lead registry unavailable' });
  }
}
