import { requireUser, audit, json, method, sql } from './_lib/security.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST', 'PUT'])) return;
  try {
    const user = await requireUser(req);
    if (req.method === 'GET') {
      const rows = user.role === 'admin'
        ? await sql`select id, kind, status, payload, created_at, decided_at from approvals order by case when status = 'pending' then 0 else 1 end, created_at desc limit 100`
        : await sql`select id, kind, status, payload, created_at, decided_at from approvals where created_by = ${user.id} order by created_at desc limit 100`;
      return json(res, 200, { approvals: rows });
    }
    if (req.method === 'POST') {
      const { kind, payload } = req.body || {};
      if (!['content', 'sync', 'workflow'].includes(kind) || !payload || typeof payload !== 'object') return json(res, 400, { error: 'A valid approval kind and payload are required' });
      if (JSON.stringify(payload).length > 20000) return json(res, 413, { error: 'Approval request is too large' });
      if (kind === 'sync' && (!['highlevel', 'boldtrail'].includes(payload.destination) || !Array.isArray(payload.leads) || payload.leads.length < 1 || payload.leads.length > 25)) {
        return json(res, 400, { error: 'Sync requests need a destination and 1 to 25 registered test records' });
      }
      const rows = await sql`insert into approvals (created_by, kind, payload) values (${user.id}, ${kind}, ${JSON.stringify(payload)}::jsonb) returning id, kind, status, payload, created_at`;
      await audit(user, 'approval.created', kind, { approvalId: rows[0].id });
      return json(res, 201, { approval: rows[0] });
    }
    if (user.role !== 'admin') return json(res, 403, { error: 'Admin access required' });
    const { id, status } = req.body || {};
    if (!id || !['approved', 'rejected'].includes(status)) return json(res, 400, { error: 'Approval id and decision are required' });
    const rows = await sql`update approvals set status = ${status}, approved_by = ${user.id}, decided_at = now() where id = ${id} and status = 'pending' returning id, kind, status, payload, decided_at`;
    if (!rows.length) return json(res, 404, { error: 'Pending approval not found' });
    await audit(user, `approval.${status}`, rows[0].kind, { approvalId: id });
    return json(res, 200, { approval: rows[0] });
  } catch (error) { return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Approval service unavailable' }); }
}
