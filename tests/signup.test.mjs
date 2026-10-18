import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'test-only-session-signing-secret';
const { issueGoogleSignupCookie, readGoogleSignupProfile } = await import('../api/_lib/signup.mjs');
const signup = (await import('../api/signup.mjs')).default;

test('Google signup profile is signed and readable from its cookie', () => {
  const cookie = issueGoogleSignupCookie({ email: 'Person@example.com', name: 'Person Name' });
  const profile = readGoogleSignupProfile({ headers: { cookie: cookie.split(';')[0] } });

  assert.equal(profile.email, 'person@example.com');
  assert.equal(profile.fullName, 'Person Name');
});

test('Google signup profile rejects a modified cookie', () => {
  const cookie = issueGoogleSignupCookie({ email: 'person@example.com', name: 'Person Name' });
  const [name, value] = cookie.split(';')[0].split('=');
  const [payload, signature] = value.split('.');
  const tampered = `${name}=${payload}.${signature.slice(0, -1)}x`;

  assert.throws(() => readGoogleSignupProfile({ headers: { cookie: tampered } }), /invalid/);
});

test('signup rejects incomplete submissions before database access', async () => {
  const headers = new Map();
  const req = { method: 'POST', headers: {}, body: {} };
  const res = {
    statusCode: 200,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    end(body) { this.body = body; }
  };

  await signup(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /every field/i);
});
