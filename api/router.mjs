import approvals from './approvals.mjs';
import adminUsers from './admin/users.mjs';
import googleAuth from './auth/google.mjs';
import googleCallback from './auth/google/callback.mjs';
import highLevelContacts from './ghl/contacts.mjs';
import highLevelPipelines from './ghl/pipelines.mjs';
import highLevelWorkflows from './ghl/workflows.mjs';
import integrations from './integrations.mjs';
import login from './login.mjs';
import logout from './logout.mjs';
import me from './me.mjs';
import opusProjects from './opus/projects.mjs';
import routing from './routing.mjs';
import sync from './sync.mjs';
import testLeads from './test-leads.mjs';
import { json } from './_lib/security.mjs';

const handlers = new Map([
  ['approvals', approvals],
  ['admin/users', adminUsers],
  ['auth/google', googleAuth],
  ['auth/google/callback', googleCallback],
  ['ghl/contacts', highLevelContacts],
  ['ghl/pipelines', highLevelPipelines],
  ['ghl/workflows', highLevelWorkflows],
  ['integrations', integrations],
  ['login', login],
  ['logout', logout],
  ['me', me],
  ['opus/projects', opusProjects],
  ['routing', routing],
  ['sync', sync],
  ['test-leads', testLeads]
]);

export default async function handler(req, res) {
  const path = new URL(req.url, 'http://localhost').searchParams.get('path') || '';
  const selected = handlers.get(path.replace(/^\/+|\/+$/g, ''));
  if (!selected) return json(res, 404, { error: 'API route not found' });
  return selected(req, res);
}
