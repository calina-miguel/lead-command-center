import { requireUser, json, method, sql } from '../_lib/security.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    const user = await requireUser(req, { admin: true });
    const users = await sql`select email, username, role, created_at from users order by role desc, created_at asc`;
    return json(res, 200, { users });
  } catch { return json(res, 500, { error: 'Unable to load team access' }); }
}
