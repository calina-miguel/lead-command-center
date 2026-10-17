import { requireUser, json, method } from './_lib/security.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    await requireUser(req);
    return json(res, 200, {
      integrations: {
        highlevel: {
          configured: Boolean(process.env.GHL_PRIVATE_INTEGRATION_TOKEN && process.env.GHL_LOCATION_ID)
        },
        boldtrail: {
          configured: Boolean(process.env.BOLDTRAIL_API_TOKEN),
          statusMapVerified: process.env.BOLDTRAIL_STATUS_MAP_VERIFIED === 'true'
        },
        opusClip: {
          configured: Boolean(process.env.OPUSCLIP_API_KEY)
        },
        messaging: {
          whatsapp: false,
          messenger: false,
          instagram: false,
          linkedin: false
        }
      }
    });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Integration status unavailable' });
  }
}
