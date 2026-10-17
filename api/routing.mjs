import { requireUser, audit, json, method, sql } from './_lib/security.mjs';
import { isValidFolderOverride, isValidRoutingPreferences } from './_lib/routing-policy.mjs';

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'PUT'])) return;
  try {
    const user = await requireUser(req);
    if (req.method === 'GET') {
      const [preferences, overrides] = await Promise.all([
        sql`select campaign_path, lead_source, default_destination, selected_folder, outcome, outcome_folder from lead_routing_preferences where user_id = ${user.id}`,
        sql`select crm, external_id, folder from lead_folder_overrides where user_id = ${user.id} order by updated_at desc limit 500`
      ]);
      return json(res, 200, { preferences: preferences[0] || null, overrides });
    }

    const body = req.body || {};
    if (body.preferences) {
      const value = body.preferences;
      if (!isValidRoutingPreferences(value)) {
        return json(res, 400, { error: 'Routing preferences contain an unsupported option' });
      }
      await sql`insert into lead_routing_preferences (user_id, campaign_path, lead_source, default_destination, selected_folder, outcome, outcome_folder)
        values (${user.id}, ${value.campaignPath}, ${value.leadSource}, ${value.defaultDestination}, ${value.selectedFolder}, ${value.outcome}, ${value.outcomeFolder})
        on conflict (user_id) do update set campaign_path = excluded.campaign_path, lead_source = excluded.lead_source,
        default_destination = excluded.default_destination, selected_folder = excluded.selected_folder,
        outcome = excluded.outcome, outcome_folder = excluded.outcome_folder, updated_at = now()`;
      await audit(user, 'routing.preferences.updated', 'lead-routing');
      return json(res, 200, { saved: true });
    }

    const value = body.override;
    if (!isValidFolderOverride(value)) {
      return json(res, 400, { error: 'Lead folder update is invalid or restricted' });
    }
    await sql`insert into lead_folder_overrides (user_id, crm, external_id, folder)
      values (${user.id}, ${value.crm}, ${value.externalId}, ${value.folder})
      on conflict (user_id, crm, external_id) do update set folder = excluded.folder, updated_at = now()`;
    await audit(user, 'routing.folder.updated', value.crm, { folder: value.folder });
    return json(res, 200, { saved: true });
  } catch (error) {
    return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Routing service unavailable' });
  }
}
