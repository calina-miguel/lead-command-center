import test from 'node:test';
import assert from 'node:assert/strict';
import { boldTrailStatusName, classifyLead, ensureOpenLead } from '../api/_lib/lead-policy.mjs';
import { isValidFolderOverride, isValidRoutingPreferences } from '../api/_lib/routing-policy.mjs';

test('HighLevel sync status gate rejects closed opportunity states', () => {
  for (const status of ['won', 'lost', 'abandoned', 'closed']) {
    assert.throws(() => ensureOpenLead({ status }), { statusCode: 409 });
  }
});

test('HighLevel open status passes the closed-lead safety check', () => {
  assert.doesNotThrow(() => ensureOpenLead({ status: 'open' }));
});

test('BoldTrail accepts only known non-client, non-closed statuses', () => {
  for (const status of [0, 4, 5, 7]) assert.ok(boldTrailStatusName(status));
  for (const status of [1, 2, 6, 3, 'unknown', null]) assert.equal(boldTrailStatusName(status), null);
});

test('lead folders require explicit CRM status or tags and keep unknowns unclassified', () => {
  assert.equal(classifyLead({ tags: ['Warm'] }), 'warm');
  assert.equal(classifyLead({ status: 'inquiry' }), 'inquiring');
  assert.equal(classifyLead({ tags: ['appointment-ready'] }), 'hot');
  assert.equal(classifyLead({ status: 'active' }), 'unclassified');
});

test('do-not-contact signals take precedence over engagement tags', () => {
  assert.equal(classifyLead({ dnd: true, tags: ['hot'] }), 'closed');
  assert.equal(classifyLead({ tags: ['warm', 'do-not-contact'] }), 'closed');
});

test('routing preferences accept only supported campaign and outcome values', () => {
  const valid = { campaignPath: 'outreach', leadSource: 'highlevel', defaultDestination: 'highlevel', selectedFolder: 'warm', outcome: 'appointment', outcomeFolder: 'hot' };
  assert.equal(isValidRoutingPreferences(valid), true);
  assert.equal(isValidRoutingPreferences({ ...valid, defaultDestination: 'unknown' }), false);
});

test('folder overrides validate CRM IDs and prevent reopening do-not-contact leads', () => {
  assert.equal(isValidFolderOverride({ crm: 'highlevel', externalId: 'contact-123', folder: 'warm' }), true);
  assert.equal(isValidFolderOverride({ crm: 'highlevel', externalId: 'contact-123', folder: 'warm', dnd: true }), false);
  assert.equal(isValidFolderOverride({ crm: 'unknown', externalId: 'contact-123', folder: 'warm' }), false);
});
