import test from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_WEB_API_KEY = 'test-web-api-key';
const firebase = await import('../api/_lib/firebase-auth.mjs');

test('Firebase signup creates a temporary account and sends its verification email', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json(requests.length === 1
      ? { localId: 'firebase-user', idToken: 'firebase-id-token', emailVerified: false }
      : { email: 'person@example.com' });
  };
  try {
    const account = await firebase.createOrResumeFirebaseSignup({ email: 'person@example.com', password: 'a-strong-test-password' });
    await firebase.sendFirebaseVerification({ idToken: account.idToken, continueUrl: 'https://app.example/marketing/verify.html' });
    assert.equal(account.emailVerified, false);
    assert.match(requests[0].url, /accounts:signUp\?key=test-web-api-key$/);
    assert.equal(requests[0].body.email, 'person@example.com');
    assert.equal(requests[1].body.requestType, 'VERIFY_EMAIL');
    assert.equal(requests[1].body.idToken, 'firebase-id-token');
    assert.equal(requests[1].body.continueUrl, 'https://app.example/marketing/verify.html');
  } finally { global.fetch = originalFetch; }
});

test('Firebase signup resumes an unverified account only with its matching password', async () => {
  const originalFetch = global.fetch;
  let call = 0;
  global.fetch = async () => {
    call += 1;
    if (call === 1) return Response.json({ error: { message: 'EMAIL_EXISTS' } }, { status: 400 });
    return Response.json({ localId: 'existing-firebase-user', idToken: 'existing-token', emailVerified: false });
  };
  try {
    const account = await firebase.createOrResumeFirebaseSignup({ email: 'person@example.com', password: 'a-strong-test-password' });
    assert.equal(call, 2);
    assert.equal(account.idToken, 'existing-token');
    assert.equal(account.emailVerified, false);
  } finally { global.fetch = originalFetch; }
});

test('Firebase verification applies only the one-time email action code', async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), body: JSON.parse(options.body) };
    return Response.json({ email: 'person@example.com', emailVerified: true, idToken: 'verified-id-token' });
  };
  try {
    const result = await firebase.applyFirebaseVerification('one-time-action-code');
    assert.match(request.url, /accounts:update\?key=test-web-api-key$/);
    assert.deepEqual(request.body, { oobCode: 'one-time-action-code', returnSecureToken: true });
    assert.equal(result.emailVerified, true);
  } finally { global.fetch = originalFetch; }
});
