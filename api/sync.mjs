import { requireUser, audit, ensureOpenLead, ghlHeaders, json, method, sql } from './_lib/security.mjs';
import { boldTrailStatusName } from './_lib/lead-policy.mjs';

const ghlBase = 'https://services.leadconnectorhq.com';
const allowedContactFields = ['firstName', 'lastName', 'email', 'phone', 'tags', 'source', 'customFields'];

async function saveJob(approvalId, userId, destination, status, result) {
  await sql`insert into sync_jobs (approval_id, requested_by, destination, status, result)
    values (${approvalId}, ${userId}, ${destination}, ${status}, ${JSON.stringify(result)}::jsonb)`;
}

async function finishJob(jobId, status, result) {
  await sql`update sync_jobs set status = ${status}, result = ${JSON.stringify(result)}::jsonb where id = ${jobId}`;
}

async function getHighLevelRecord(lead) {
  if (!lead.opportunityId) throw Object.assign(new Error('Every test record must include its HighLevel opportunity id'), { statusCode: 409 });
  const response = await fetch(`${ghlBase}/opportunities/${encodeURIComponent(lead.opportunityId)}`, {
    headers: { ...ghlHeaders(), Version: 'v3' }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error('Unable to verify the current HighLevel record'), { statusCode: response.status });
  const opportunity = body.opportunity || body;
  if (String(opportunity.status || '').toLowerCase() !== 'open') {
    throw Object.assign(new Error('Only opportunities with a confirmed open status can be synced'), { statusCode: 409 });
  }
  ensureOpenLead(opportunity);
  if (!opportunity.contactId) throw Object.assign(new Error('The open opportunity has no linked contact'), { statusCode: 409 });
  const contact = Object.fromEntries(allowedContactFields.filter((key) => lead[key] !== undefined).map((key) => [key, lead[key]]));
  if (!Object.keys(contact).length) throw Object.assign(new Error('No supported contact fields were provided'), { statusCode: 400 });
  return { opportunityId: lead.opportunityId, contactId: opportunity.contactId, contact };
}

async function getBoldTrailRecord(lead) {
  if (!process.env.BOLDTRAIL_API_TOKEN) throw Object.assign(new Error('BoldTrail integration is not configured'), { statusCode: 503 });
  if (process.env.BOLDTRAIL_STATUS_MAP_VERIFIED !== 'true') throw Object.assign(new Error('BoldTrail status mapping must be verified with the account owner before sync is enabled'), { statusCode: 503 });
  if (!lead.contactId) throw Object.assign(new Error('Every test record must include its BoldTrail contact id'), { statusCode: 409 });
  const base = (process.env.BOLDTRAIL_API_BASE_URL || 'https://api.kvcore.com/v2/public').replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${process.env.BOLDTRAIL_API_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json' };
  const response = await fetch(`${base}/contacts/${encodeURIComponent(lead.contactId)}`, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error('Unable to verify the current BoldTrail contact'), { statusCode: response.status });
  const contact = body.data || body.contact || body;
  const status = boldTrailStatusName(contact.status);
  if (!status) {
    throw Object.assign(new Error('The BoldTrail contact is closed, client-status, archived, or has an unrecognized status'), { statusCode: 409 });
  }
  const contactFields = Object.fromEntries([
    ['firstName', 'first_name'], ['lastName', 'last_name'], ['email', 'email'], ['phone', 'cell_phone_1']
  ].filter(([source]) => lead[source] !== undefined).map(([source, target]) => [target, lead[source]]));
  if (!Object.keys(contactFields).length) throw Object.assign(new Error('No supported BoldTrail contact fields were provided'), { statusCode: 400 });
  return { contactId: lead.contactId, contact: contactFields, status, headers, base };
}

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  let user;
  try {
    user = await requireUser(req, { admin: true });
    const { approvalId, destination = 'highlevel', execute = false } = req.body || {};
    if (!approvalId || !['highlevel', 'boldtrail'].includes(destination)) return json(res, 400, { error: 'Approval id and supported destination are required' });
    const rows = await sql`select id, status, payload from approvals where id = ${approvalId} and kind = 'sync' limit 1`;
    const approval = rows[0];
    if (!approval || approval.status !== 'approved') return json(res, 409, { error: 'An approved sync request is required' });
    if (approval.payload.destination !== destination) return json(res, 409, { error: 'The sync destination must match the approved request' });
    const leads = Array.isArray(approval.payload.leads) ? approval.payload.leads : [];
    if (!leads.length || leads.length > 25) return json(res, 400, { error: 'Sync requests must contain 1 to 25 test records' });
    const externalIds = leads.map((lead) => destination === 'highlevel' ? lead.opportunityId : lead.contactId);
    if (externalIds.some((id) => !id)) return json(res, 409, { error: 'Every sync record must include its CRM record id' });
    const allowlisted = await sql`select external_id from test_leads where crm = ${destination} and external_id = any(${externalIds})`;
    const allowlist = new Set(allowlisted.map((row) => row.external_id));
    if (externalIds.some((id) => !allowlist.has(id))) return json(res, 403, { error: 'Sync is restricted to test records registered in the admin panel' });

    // Verify every record first so a closed lead cannot be updated after earlier items succeeded.
    const verified = [];
    try {
      for (const lead of leads) verified.push(destination === 'highlevel' ? await getHighLevelRecord(lead) : await getBoldTrailRecord(lead));
    } catch (error) {
      await saveJob(approvalId, user.id, destination, 'rejected', { reason: error.message });
      throw error;
    }
    if (!execute) {
      const result = { eligible: verified.length, message: 'Live status verified; no CRM records were changed.' };
      await saveJob(approvalId, user.id, destination, 'dry_run', result);
      await audit(user, 'crm.sync.dry_run', destination, { approvalId, count: verified.length });
      return json(res, 200, { status: 'dry_run', destination, ...result });
    }

    const reservation = await sql`insert into sync_jobs (approval_id, requested_by, destination, status, execution_key, result)
      values (${approvalId}, ${user.id}, ${destination}, 'running', ${`${destination}:${approvalId}`}, ${JSON.stringify({ count: verified.length })}::jsonb)
      on conflict do nothing returning id`;
    if (!reservation.length) return json(res, 409, { error: 'This approved sync has already been started; create a new approved test request for another run' });
    const jobId = reservation[0].id;
    const results = [];
    try {
      for (const record of verified) {
        const response = destination === 'highlevel'
          ? await fetch(`${ghlBase}/contacts/${encodeURIComponent(record.contactId)}`, { method: 'PUT', headers: ghlHeaders(), body: JSON.stringify(record.contact) })
          : await fetch(`${record.base}/contacts/${encodeURIComponent(record.contactId)}`, { method: 'PUT', headers: record.headers, body: JSON.stringify(record.contact) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw Object.assign(new Error(`${destination} contact update failed (${response.status})`), { statusCode: response.status });
        results.push({ id: record.contactId, ok: true });
      }
    } catch (error) {
      await finishJob(jobId, 'failed', { updated: results.length, reason: error.message });
      throw error;
    }
    await finishJob(jobId, 'completed', { count: results.length });
    await audit(user, 'crm.sync.completed', destination, { approvalId, count: results.length });
    return json(res, 200, { status: 'completed', destination, results });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'CRM sync unavailable' });
  }
}
