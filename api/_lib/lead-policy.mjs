const boldTrailStatuses = new Map([[0, 'new'], [1, 'client'], [2, 'closed'], [4, 'active'], [5, 'contract'], [6, 'archived'], [7, 'prospect']]);
const closedStatuses = new Set(['closed', 'won', 'lost', 'abandoned', 'closed-won', 'closed-lost', 'do-not-contact', 'dnc', 'archived']);

export function classifyLead(contact = {}) {
  const values = [contact.status, contact.stage, contact.lifecycleStage, ...(Array.isArray(contact.tags) ? contact.tags : [])]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase().replace(/[_\s]+/g, '-'));
  if (contact.dnd === true || values.some((value) => closedStatuses.has(value) || /^(client|do-not-contact|dnc|archived)$/.test(value))) return 'closed';
  if (values.some((value) => /(^|-)hot($|-)|appointment-ready|ready-to-act/.test(value))) return 'hot';
  if (values.some((value) => /(^|-)warm($|-)|showing-interest/.test(value))) return 'warm';
  if (values.some((value) => /inquir|asked-for-info|requested-information/.test(value))) return 'inquiring';
  if (values.some((value) => /(^|-)cold($|-)|not-engaged/.test(value))) return 'cold';
  return 'unclassified';
}

export function ensureOpenLead(lead = {}) {
  const values = [lead.status, lead.stage, lead.pipelineStage, lead.lifecycleStage, lead.opportunity?.status]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase().replace(/\s+/g, '-'));
  if (values.some((value) => closedStatuses.has(value))) {
    throw Object.assign(new Error('Closed leads are not eligible for sync'), { statusCode: 409 });
  }
}

export function boldTrailStatusName(value) {
  if (value === null || value === undefined || value === '') return null;
  const status = Number(value);
  if (!boldTrailStatuses.has(status) || [1, 2, 6].includes(status)) return null;
  return boldTrailStatuses.get(status);
}
