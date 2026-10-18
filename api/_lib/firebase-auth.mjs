const endpoint = 'https://identitytoolkit.googleapis.com/v1';

function configuration() {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw Object.assign(new Error('Firebase Authentication is not configured'), { statusCode: 503 });
  return apiKey;
}

async function request(path, body) {
  const response = await fetch(`${endpoint}/${path}?key=${encodeURIComponent(configuration())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = result.error?.message || 'FIREBASE_AUTH_ERROR';
    const error = new Error(code);
    error.firebaseCode = code;
    error.statusCode = response.status;
    throw error;
  }
  return result;
}

export async function createOrResumeFirebaseSignup({ email, password }) {
  try {
    const account = await request('accounts:signUp', { email, password, returnSecureToken: true });
    return { idToken: account.idToken, emailVerified: Boolean(account.emailVerified) };
  } catch (error) {
    if (error.firebaseCode !== 'EMAIL_EXISTS') throw error;
    const account = await request('accounts:signInWithPassword', { email, password, returnSecureToken: true });
    return { idToken: account.idToken, emailVerified: Boolean(account.emailVerified) };
  }
}

export async function sendFirebaseVerification({ idToken, continueUrl }) {
  return request('accounts:sendOobCode', {
    requestType: 'VERIFY_EMAIL',
    idToken,
    continueUrl,
    canHandleCodeInApp: true
  });
}

export async function applyFirebaseVerification(oobCode) {
  return request('accounts:update', { oobCode, returnSecureToken: true });
}

export async function deleteFirebaseSignup(idToken) {
  return request('accounts:delete', { idToken });
}
