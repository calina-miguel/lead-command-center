import { sql, readSessionToken, tokenHash, json, method } from './_lib/security.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  const token = readSessionToken(req);
  if (token) await sql`delete from sessions where token_hash = ${tokenHash(token)}`;
  res.setHeader('Set-Cookie', 'bg_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0');
  return json(res, 200, { ok: true });
}
