import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

const b64 = (value) => Buffer.from(value).toString('base64url');
const unb64 = (value) => Buffer.from(value, 'base64url');

export async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key)));
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [, salt, expected] = stored.split('$');
  const candidate = await hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidate.split('$')[2], 'hex'), Buffer.from(expected, 'hex'));
}

export function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

export function issueSessionCookie(token) {
  return `bg_session=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800`;
}

export function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const found = raw.split(';').map((part) => part.trim().split('=')) .find(([key]) => key === name);
  return found ? decodeURIComponent(found[1]) : null;
}

export async function requireUser(req, { admin = false } = {}) {
  const token = readCookie(req, 'bg_session');
  if (!token) throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
  const rows = await sql`select u.id, u.email, u.role from sessions s join users u on u.id = s.user_id where s.token_hash = ${tokenHash(token)} and s.expires_at > now()`;
  const user = rows[0];
  if (!user || (admin && user.role !== 'admin')) throw Object.assign(new Error('Admin access required'), { statusCode: 403 });
  return user;
}

export async function audit(user, action, resource, metadata = {}) {
  await sql`insert into audit_logs (user_id, action, resource, metadata) values (${user.id}, ${action}, ${resource}, ${JSON.stringify(metadata)}::jsonb)`;
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function method(req, res, allowed) {
  res.setHeader('Access-Control-Allow-Origin', 'https://calina-miguel.github.io');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return false; }
  if (!allowed.includes(req.method)) { res.setHeader('Allow', allowed.join(', ')); json(res, 405, { error: 'Method not allowed' }); return false; }
  return true;
}

export function ghlHeaders() {
  return { Authorization: `Bearer ${process.env.GHL_PRIVATE_INTEGRATION_TOKEN}`, Version: '2021-07-28', Accept: 'application/json', 'Content-Type': 'application/json' };
}
