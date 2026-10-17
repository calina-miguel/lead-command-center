import { isIP } from 'node:net';
import { requireUser, audit, json, method } from '../_lib/security.mjs';

function validVideoUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost' || url.hostname.endsWith('.local')) return false;
  const ipVersion = isIP(url.hostname);
  if (ipVersion === 4 && (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname))) return false;
  if (ipVersion === 6 && (url.hostname === '::1' || url.hostname.startsWith('fc') || url.hostname.startsWith('fd') || url.hostname.startsWith('fe80:'))) return false;
  return true;
}

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const user = await requireUser(req);
    if (!process.env.OPUSCLIP_API_KEY) return json(res, 503, { error: 'Video clipping is not connected yet' });
    const { videoUrl, audience } = req.body || {};
    if (!validVideoUrl(videoUrl) || !['prospects', 'agents'].includes(audience)) return json(res, 400, { error: 'Provide a public HTTPS video URL and choose the content path' });
    const response = await fetch('https://api.opus.pro/api/clip-projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPUSCLIP_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ videoUrl })
    });
    const payload = await response.json().catch(() => ({}));
    await audit(user, 'video.clip_project.created', 'opusclip', { audience, ok: response.ok });
    if (!response.ok) return json(res, response.status >= 500 ? 502 : response.status, { error: payload.message || payload.error || 'Opus Clip could not create the project' });
    return json(res, 201, { project: payload });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Video clipping service unavailable' });
  }
}
