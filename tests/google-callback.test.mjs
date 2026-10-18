import test from 'node:test';
import assert from 'node:assert/strict';
import callback from '../api/auth/google/callback.mjs';

test('legacy Google callback hosts forward the response to the canonical host', async () => {
  const headers = new Map();
  const req = {
    headers: { host: 'lead-command-center-phi.vercel.app' },
    url: '/api/auth/google/callback?code=temporary-code&state=temporary-state',
    query: { code: 'temporary-code', state: 'temporary-state' }
  };
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end() {}
  };

  await callback(req, res);

  assert.equal(res.statusCode, 302);
  assert.equal(
    headers.get('location'),
    'https://black-glove-systems.vercel.app/api/auth/google/callback?code=temporary-code&state=temporary-state'
  );
});

test('canonical Google callback still validates OAuth state', async () => {
  const headers = new Map();
  const req = {
    headers: { host: 'black-glove-systems.vercel.app', cookie: 'google_oauth_state=expected-state' },
    url: '/api/auth/google/callback?code=temporary-code&state=wrong-state',
    query: { code: 'temporary-code', state: 'wrong-state' }
  };
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end() {}
  };

  await callback(req, res);

  assert.equal(res.statusCode, 302);
  assert.equal(headers.get('location'), '/marketing/?google=cancelled');
});
