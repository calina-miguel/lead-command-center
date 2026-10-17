const paths = new Set(['outreach', 'agents']);
const sources = new Set(['boldtrail', 'highlevel', 'website', 'referrals']);
const destinations = new Set(['highlevel', 'boldtrail', 'hubspot', 'salesforce']);
const folders = new Set(['cold', 'inquiring', 'warm', 'hot', 'closed', 'unclassified']);
const outcomes = new Set(['needs_reply', 'appointment', 'qualified', 'not_interested', 'do_not_contact']);
const outcomeFolders = new Set(['inquiring', 'warm', 'hot', 'closed']);

export function isValidRoutingPreferences(value = {}) {
  return paths.has(value.campaignPath) && sources.has(value.leadSource) && destinations.has(value.defaultDestination) &&
    folders.has(value.selectedFolder) && outcomes.has(value.outcome) && outcomeFolders.has(value.outcomeFolder);
}

export function isValidFolderOverride(value = {}) {
  return ['highlevel', 'boldtrail'].includes(value.crm) && typeof value.externalId === 'string' &&
    /^[\w-]{3,100}$/.test(value.externalId) && folders.has(value.folder) &&
    !(value.dnd === true && value.folder !== 'closed');
}
