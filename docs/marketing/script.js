const API = location.origin;
const api = (path, options = {}) => fetch(`${API}${path}`, { credentials: 'include', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
const toast = document.querySelector('#toast');
const crmDestination = document.querySelector('#crm-destination');
const sourcePath = document.querySelector('#source-path');
const leadSource = document.querySelector('#lead-source');
const videoFile = document.querySelector('#video-file');
let clipProjectId = '';
let userRole = 'member';
let importedLeads = [];
let nextLeadPage = null;
let folderOverrides = {};
let activeSegment = localStorage.getItem('black-glove-marketing-segment') || 'warm';

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function loadUser() {
  try {
    const data = await readResponse(await api('/api/me'));
    const email = data.user.email;
    const displayName = data.user.username || email.split('@')[0];
    const initials = displayName.split(/[\s._-]/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
    userRole = data.user.role;
    document.querySelector('#signed-in-user').textContent = displayName;
    document.querySelector('#profile-trigger').setAttribute('aria-label', `Account menu for ${displayName}`);
    document.querySelector('#profile-email').textContent = email;
    document.querySelector('#profile-avatar').textContent = initials || 'BG';
    document.querySelector('#profile-menu-avatar').textContent = initials || 'BG';
    document.querySelector('#profile-menu-name').textContent = data.user.username || email.split('@')[0];
    document.querySelector('#profile-dialog-name').textContent = displayName;
    document.querySelector('#profile-dialog-email').textContent = email;
    document.querySelector('#profile-dialog-role').textContent = userRole;
    if (userRole === 'admin') {
      document.querySelector('#admin-controls').hidden = false;
      document.querySelector('#admin-user').textContent = email;
    }
    await loadRoutingState();
  } catch {
    location.replace('./');
  }
}

loadUser();

crmDestination.value = localStorage.getItem('black-glove-marketing-crm') || 'highlevel';
sourcePath.value = localStorage.getItem('black-glove-marketing-source-path') || 'outreach';
leadSource.value = localStorage.getItem('black-glove-marketing-lead-source') || 'boldtrail';
document.querySelector('#content-audience').value = activeSegment === 'closed' ? 'unclassified' : activeSegment;
document.querySelector('#segment-rule').value = activeSegment === 'closed' ? 'unclassified' : activeSegment;
document.querySelectorAll('[data-segment]').forEach((button) => button.classList.toggle('selected', button.dataset.segment === document.querySelector('#segment-rule').value));

function applySegment(segment) {
  activeSegment = segment;
  const contentAudience = document.querySelector('#content-audience');
  const validContentSegments = [...contentAudience.options].map((option) => option.value);
  document.querySelector('#segment-rule').value = validContentSegments.includes(segment) ? segment : 'unclassified';
  if (validContentSegments.includes(segment)) contentAudience.value = segment;
  localStorage.setItem('black-glove-marketing-segment', segment);
  document.querySelectorAll('[data-segment]').forEach((button) => button.classList.toggle('selected', button.dataset.segment === segment));
  document.querySelector('#segment-source-label').textContent = `${segment === 'agents' ? 'Agent recruitment' : `${segment[0].toUpperCase()}${segment.slice(1)} folder`} · awaiting CRM data`;
  renderLeadFolders();
}

function getFolderOverrides() {
  return folderOverrides;
}

async function loadRoutingState() {
  try {
    const data = await readResponse(await api('/api/routing'));
    folderOverrides = Object.fromEntries((data.overrides || []).map((item) => [`${item.crm}:${item.external_id}`, item.folder]));
    const preferences = data.preferences;
    if (preferences) {
      const selectedFolder = preferences.selected_folder === 'closed' ? 'unclassified' : preferences.selected_folder;
      crmDestination.value = preferences.default_destination;
      sourcePath.value = preferences.campaign_path;
      leadSource.value = preferences.lead_source;
      document.querySelector('#segment-rule').value = selectedFolder;
      document.querySelector('#conversation-outcome').value = preferences.outcome;
      document.querySelector('#outcome-folder').value = preferences.outcome_folder;
      activeSegment = selectedFolder;
      document.querySelector('#content-audience').value = activeSegment === 'closed' ? 'unclassified' : activeSegment;
      document.querySelectorAll('[data-segment]').forEach((button) => button.classList.toggle('selected', button.dataset.segment === activeSegment));
    }
    renderLeadFolders();
    document.querySelector('#outcome-status').textContent = 'Routing preferences and folder overrides are stored for your account.';
  } catch {
    document.querySelector('#outcome-status').textContent = 'Workspace routing storage is unavailable until the database migration is applied.';
  }
}

function currentRoutingPreferences() {
  return {
    campaignPath: sourcePath.value,
    leadSource: leadSource.value,
    defaultDestination: crmDestination.value,
    selectedFolder: document.querySelector('#segment-rule').value,
    outcome: document.querySelector('#conversation-outcome').value,
    outcomeFolder: document.querySelector('#outcome-folder').value
  };
}

async function saveRoutingPreferences() {
  await readResponse(await api('/api/routing', { method: 'PUT', body: JSON.stringify({ preferences: currentRoutingPreferences() }) }));
}

function renderLeadFolders() {
  const counts = Object.fromEntries(['cold', 'inquiring', 'warm', 'hot', 'closed', 'unclassified'].map((folder) => [folder, 0]));
  importedLeads.forEach((lead) => { counts[lead.category] = (counts[lead.category] || 0) + 1; });
  document.querySelectorAll('[data-segment]').forEach((button) => {
    button.querySelector('.segment-count').textContent = importedLeads.length ? String(counts[button.dataset.segment] || 0) : '—';
    button.setAttribute('aria-pressed', String(button.dataset.segment === activeSegment));
  });
  document.querySelector('#metric-leads').textContent = importedLeads.length ? String(importedLeads.length) : '—';
  const body = document.querySelector('#imported-leads');
  body.replaceChildren();
  if (!importedLeads.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td'); cell.colSpan = 5; cell.className = 'empty-leads';
    cell.textContent = 'No leads imported yet. Use a read-only CRM import to begin.';
    row.append(cell); body.append(row); return;
  }
  const visible = importedLeads.filter((lead) => lead.category === activeSegment);
  if (!visible.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td'); cell.colSpan = 5; cell.className = 'empty-leads';
    cell.textContent = `No leads in the ${activeSegment} folder. Choose another folder to review the imported batch.`;
    row.append(cell); body.append(row); return;
  }
  for (const lead of visible) {
    const row = document.createElement('tr');
    for (const value of [lead.name, lead.source, lead.status]) {
      const cell = document.createElement('td'); cell.textContent = value || 'Not provided'; row.append(cell);
    }
    const folderCell = document.createElement('td');
    const selector = document.createElement('select'); selector.className = 'field-control lead-folder-select'; selector.setAttribute('aria-label', `Folder for ${lead.name}`);
    for (const [value, label] of [['cold','Cold'],['inquiring','Inquiring'],['warm','Warm'],['hot','Hot'],['closed','Closed / do not contact'],['unclassified','Needs review']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = value === lead.category; selector.append(option);
    }
    const save = document.createElement('button'); save.type = 'button'; save.className = 'secondary route-lead'; save.textContent = 'Route'; save.dataset.leadId = lead.id;
    folderCell.append(selector, save); row.append(folderCell);
    const actionCell = document.createElement('td');
    if (lead.category !== 'closed' && lead.category !== 'unclassified') {
      const draft = document.createElement('button'); draft.type = 'button'; draft.className = 'secondary draft-for-folder'; draft.textContent = 'Draft'; draft.dataset.category = lead.category; actionCell.append(draft);
    } else actionCell.textContent = lead.category === 'closed' ? 'Excluded' : 'Classify first';
    row.append(actionCell); body.append(row);
  }
  body.querySelectorAll('.route-lead').forEach((button) => button.addEventListener('click', async () => {
    const lead = importedLeads.find((item) => item.id === button.dataset.leadId);
    const selectedFolder = button.parentElement.querySelector('select').value;
    if (!lead) return;
    if (lead.dnd && selectedFolder !== 'closed') { showToast('Do-not-contact records cannot be reopened from this workspace'); return; }
    button.disabled = true;
    try {
      const crm = lead.crm || 'highlevel';
      await readResponse(await api('/api/routing', { method: 'PUT', body: JSON.stringify({ override: { crm, externalId: lead.id, folder: selectedFolder, dnd: lead.dnd === true } }) }));
      folderOverrides[`${crm}:${lead.id}`] = selectedFolder;
      lead.category = selectedFolder;
      showToast('Folder saved to your workspace; CRM record was not changed');
      renderLeadFolders();
    } catch (error) {
      button.disabled = false;
      showToast(`Folder was not saved: ${error.message}`);
    }
  }));
  body.querySelectorAll('.draft-for-folder').forEach((button) => button.addEventListener('click', () => {
    document.querySelector('#content-audience').value = button.dataset.category;
    document.querySelector('#content-production').scrollIntoView({ behavior: 'smooth', block: 'start' });
    generateContentDraft();
  }));
}

document.querySelectorAll('[data-segment]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.segment === 'closed') {
    showToast('Closed and do-not-contact leads are excluded from outreach');
    return;
  }
  applySegment(button.dataset.segment);
}));

document.querySelector('#save-crm').addEventListener('click', async () => {
  try {
    await saveRoutingPreferences();
  localStorage.setItem('black-glove-marketing-crm', crmDestination.value);
  document.querySelector('#settings-crm').value = crmDestination.value;
  showToast(`${crmDestination.options[crmDestination.selectedIndex].text} saved as the default destination`);
  } catch (error) { showToast(`Destination was not saved: ${error.message}`); }
});
document.querySelector('#save-source').addEventListener('click', async () => {
  try {
    await saveRoutingPreferences();
  localStorage.setItem('black-glove-marketing-source-path', sourcePath.value);
  localStorage.setItem('black-glove-marketing-lead-source', leadSource.value);
  applySegment(document.querySelector('#segment-rule').value);
  showToast('Campaign source and folder routing saved to your workspace');
  } catch (error) { showToast(`Routing was not saved: ${error.message}`); }
});

async function loadIntegrationStatus() {
  try {
    const { integrations } = await readResponse(await api('/api/integrations'));
    const activeSources = Number(integrations.highlevel.configured) + Number(integrations.boldtrail.configured && integrations.boldtrail.statusMapVerified);
    document.querySelector('#metric-sources').textContent = `${activeSources} / 2`;
    if (integrations.highlevel.configured) {
      document.querySelector('#highlevel-status').textContent = 'Configured';
      document.querySelector('#highlevel-status').classList.replace('pending', 'configured');
      document.querySelector('#highlevel-result').textContent = 'Credentials are present. Run a connection check before importing records.';
    }
    if (integrations.boldtrail.configured) {
      document.querySelector('#boldtrail-result').textContent = integrations.boldtrail.statusMapVerified
        ? 'Credentials and status map are configured. Verify the connection before importing records.'
        : 'Credentials found; account-specific status mapping is not verified, so CRM sync remains disabled.';
      if (integrations.boldtrail.statusMapVerified) {
        document.querySelector('#boldtrail-status').textContent = 'Configured';
        document.querySelector('#boldtrail-status').classList.replace('pending', 'configured');
      }
    }
    if (integrations.opusClip.configured) document.querySelector('#clip-status').textContent = 'Opus Clip credentials are configured. A clip project still needs review before use.';
  } catch {
    document.querySelector('#metric-sources').textContent = '—';
  }
}
loadIntegrationStatus();

async function importHighLevelLeads() {
  const button = document.querySelector('#import-highlevel');
  const status = document.querySelector('#highlevel-result');
  const page = nextLeadPage;
  button.disabled = true;
  button.textContent = page ? 'Loading next page…' : 'Importing…';
  status.textContent = 'Reading a limited page of HighLevel contacts. No CRM records are changed.';
  const query = new URLSearchParams({ limit: '50' });
  if (page) {
    query.set('page', String(page));
  } else importedLeads = [];
  try {
    const data = await readResponse(await api(`/api/ghl/contacts?${query}`));
    const overrides = getFolderOverrides();
    for (const lead of data.leads || []) {
      const normalized = { ...lead, category: overrides[`${lead.crm}:${lead.id}`] || lead.category };
      const existing = importedLeads.findIndex((item) => item.id === normalized.id);
      if (existing >= 0) importedLeads[existing] = normalized;
      else importedLeads.push(normalized);
    }
    nextLeadPage = data.nextPage;
    document.querySelector('#segment-source-label').textContent = `${importedLeads.length} read-only records loaded from HighLevel`;
    document.querySelector('#highlevel-status').textContent = 'Read access verified';
    document.querySelector('#highlevel-status').classList.remove('pending');
    document.querySelector('#highlevel-status').classList.add('configured');
    status.textContent = `${data.leads?.length || 0} contacts loaded from this page. Names and status only; email and phone are not shown.`;
    button.textContent = nextLeadPage ? 'Load next page' : 'Import latest leads';
    renderLeadFolders();
    showToast('HighLevel contacts loaded read-only; no CRM records changed');
  } catch (error) {
    status.textContent = error.message;
    button.textContent = 'Import latest leads';
    showToast('HighLevel import could not complete');
  } finally { button.disabled = false; }
}
document.querySelector('#import-highlevel').addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  importHighLevelLeads();
});

document.querySelector('#check-highlevel').addEventListener('click', async () => {
  const status = document.querySelector('#highlevel-status');
  const result = document.querySelector('#highlevel-result');
  result.textContent = 'Checking HighLevel pipeline access…';
  try {
    const data = await readResponse(await api('/api/ghl/pipelines'));
    const pipelines = data.pipelines || data.opportunities?.pipelines || [];
    status.textContent = 'Verified';
    status.classList.remove('pending');
    status.classList.add('configured');
    result.textContent = `${pipelines.length || 'Available'} pipeline configuration returned. This check does not import contacts.`;
    showToast('HighLevel pipeline access verified; no lead records imported');
  } catch (error) {
    status.textContent = 'Needs attention';
    result.textContent = error.message;
  }
});

document.querySelector('#check-boldtrail').addEventListener('click', async () => {
  const result = document.querySelector('#boldtrail-result');
  result.textContent = 'Checking provider configuration…';
  try {
    const { integrations } = await readResponse(await api('/api/integrations'));
    const status = document.querySelector('#boldtrail-status');
    if (!integrations.boldtrail.configured) result.textContent = 'BoldTrail API credentials are not configured.';
    else if (!integrations.boldtrail.statusMapVerified) result.textContent = 'Credentials are present, but status mapping is unverified. Sync stays disabled.';
    else result.textContent = 'Credentials and verified status map are present. A live API contract check is still needed.';
    status.textContent = integrations.boldtrail.configured && integrations.boldtrail.statusMapVerified ? 'Configured' : 'Setup needed';
    showToast('BoldTrail setup checked; no contacts queried or changed');
  } catch (error) { result.textContent = error.message; }
});

const contentTemplates = {
  cold: {
    message: 'Hi there, I’m reaching out with a useful local real-estate update. If a move is on your horizon, I can share a few options tailored to what you are looking for. Would that be helpful?',
    ad: 'A better-informed move starts with the right local insight. Get a clear look at your options, timing, and next steps with a real-estate team that knows the area.',
    landing: 'Explore your next move with confidence. Share what matters most to you, and our team will prepare relevant local options and a straightforward plan.',
    video: 'Short video concept: open with one practical local-market insight, explain why it matters to a buyer or seller, then invite viewers to ask for options that fit their goals.'
  },
  inquiring: {
    message: 'Thanks for reaching out. I can help with that. What would be most useful next: details on the property, nearby options, or a quick conversation with our team?',
    ad: 'Have questions about your next real-estate step? Get clear answers, relevant options, and a simple path forward from a local team.',
    landing: 'Get answers for your real-estate question. Tell us what you are exploring and choose the next step that works for you.',
    video: 'Short video concept: answer one common buyer or seller question in plain language, offer a practical next step, and invite viewers to send their specific question.'
  },
  warm: {
    message: 'Based on what you are exploring, the next useful step may be a short conversation to compare options and timing. Would you prefer to talk this week or keep the details here?',
    ad: 'When you are ready to compare your options, a clear plan makes the difference. Talk through timing, priorities, and the next step with our real-estate team.',
    landing: 'Turn your real-estate plans into a clear next step. Share your priorities and timing so our team can prepare a focused set of options for you.',
    video: 'Short video concept: show how a buyer or seller can compare choices, timing, and tradeoffs, then close with an invitation to plan a focused consultation.'
  },
  hot: {
    message: 'I can connect you with a team member to help with the next step. Would you like us to arrange a conversation, or is there a detail you need first?',
    ad: 'Ready to take the next step? Connect with a real-estate professional who can help you review the details and coordinate what happens next.',
    landing: 'Talk with our team about your next step. Choose a convenient time and let us know what you need help coordinating.',
    video: 'Short video concept: clearly outline the next step in a real-estate transaction, reassure viewers that a person will guide the details, and invite them to connect.'
  },
  agents: {
    message: 'Thanks for your interest in learning more about our team. What would you like to know about the support, culture, or growth opportunities available to agents?',
    ad: 'Build your real-estate business with a team that values thoughtful service, practical support, and long-term growth. Start a conversation about whether we are a fit.',
    landing: 'Explore a new path for your real-estate career. Learn about our team, support, and expectations, then decide whether a conversation makes sense.',
    video: 'Short video concept: introduce the team’s working principles, share one real example of agent support, and invite agents to ask about fit and expectations.'
  }
};

function generateContentDraft() {
  const segment = document.querySelector('#content-audience').value;
  const type = document.querySelector('#content-type').value;
  const goal = document.querySelector('#content-goal').value.trim();
  const draft = contentTemplates[segment]?.[type];
  if (segment === 'unclassified') { showToast('Classify the lead before drafting targeted content'); return; }
  if (!draft) return;
  const objectiveLine = goal ? `\n\nCampaign objective: ${goal}` : '';
  document.querySelector('#content-draft').value = `${draft}${objectiveLine}`;
  document.querySelector('#draft-state').textContent = 'Template draft · review needed';
  showToast('Draft prepared from a built-in template; review before use');
}
document.querySelector('#generate-content').addEventListener('click', generateContentDraft);
document.querySelector('#content-audience').addEventListener('change', (event) => applySegment(event.target.value));

videoFile.addEventListener('change', () => {
  document.querySelector('#video-status').textContent = videoFile.files[0]
    ? `${videoFile.files[0].name} selected locally; it has not been uploaded.`
    : 'A selected file stays on this device; it is not uploaded.';
});
document.querySelector('#create-clips').addEventListener('click', async () => {
  const status = document.querySelector('#clip-status');
  if (document.querySelector('#clip-provider').value !== 'opus-clip') { status.textContent = 'Only Opus Clip has an API route; choose it after an admin connects that account.'; return; }
  status.textContent = 'Submitting the video URL to Opus Clip…';
  try {
    const data = await readResponse(await api('/api/opus/projects', {
      method: 'POST', body: JSON.stringify({ videoUrl: document.querySelector('#video-url').value.trim(), audience: document.querySelector('#content-audience').value })
    }));
    const project = data.project || {};
    clipProjectId = project.id || project.projectId || project.data?.id || project.data?.projectId || '';
    status.textContent = clipProjectId ? `Opus Clip project ${clipProjectId} created. Review the clips in Opus Clip before requesting approval.` : 'Opus Clip accepted the project. Review its response in your Opus Clip account before continuing.';
    showToast('Clip project created; nothing was published or sent');
  } catch (error) { status.textContent = error.message; }
});

document.querySelector('#queue-content').addEventListener('click', async () => {
  const destinations = [...document.querySelectorAll('.destination-list input:checked')].map((input) => input.value);
  const draft = document.querySelector('#content-draft').value.trim();
  if (!draft) { showToast('Generate or write a draft before submitting it'); return; }
  if (!destinations.length) { showToast('Choose at least one proposed destination'); return; }
  const payload = {
    audience: document.querySelector('#content-audience').value,
    contentType: document.querySelector('#content-type').value,
    content: draft,
    objective: document.querySelector('#content-goal').value.trim(),
    provider: document.querySelector('#clip-provider').value,
    videoUrl: document.querySelector('#video-url').value.trim() || undefined,
    clipProjectId: clipProjectId || undefined,
    destinations,
    crm: crmDestination.value,
    publishRequested: false,
    emailRequested: false
  };
  try {
    await readResponse(await api('/api/approvals', { method: 'POST', body: JSON.stringify({ kind: 'content', payload }) }));
    document.querySelector('#draft-state').textContent = 'Submitted for approval';
    showToast('Draft submitted for approval; nothing was published or sent');
  } catch (error) { showToast(error.message); }
});

const chatbotReplies = [
  { match: /schedule|appointment|tour|visit|meet|call|ready to/i, response: 'I can help coordinate that. A team member should confirm the details and availability with you. What day or time works best?', outcome: 'appointment', folder: 'hot' },
  { match: /price|cost|available|availability|address|location|listing|property/i, response: 'I can help get the right details. To avoid guessing, I’ll have a team member confirm the current information with you. What would you like us to check?', outcome: 'needs_reply', folder: 'inquiring' },
  { match: /stop|unsubscribe|do not contact|don't contact/i, response: 'Understood. We will mark this conversation for no further outreach and have a team member confirm the request.', outcome: 'do_not_contact', folder: 'closed' }
];
document.querySelector('#test-chatbot').addEventListener('click', () => {
  const question = document.querySelector('#chat-question').value.trim();
  const answer = document.querySelector('#chat-answer');
  if (!question) { answer.textContent = 'Enter a sample question to preview the rule-based response.'; return; }
  const match = chatbotReplies.find((rule) => rule.match.test(question));
  answer.textContent = match?.response || 'Thanks for your question. I can help route it to the right person. What would you most like help with? A team member will confirm any account-specific details.';
  if (match) {
    document.querySelector('#conversation-outcome').value = match.outcome;
    document.querySelector('#outcome-folder').value = match.folder;
  } else {
    document.querySelector('#conversation-outcome').value = 'needs_reply';
    document.querySelector('#outcome-folder').value = document.querySelector('#chat-segment').value;
  }
});
document.querySelector('#save-outcome').addEventListener('click', async () => {
  try {
    await saveRoutingPreferences();
    document.querySelector('#outcome-status').textContent = 'Routing preferences are saved to your account. CRM changes still require approval.';
    showToast('Outcome routing saved; no lead record changed');
  } catch (error) {
    document.querySelector('#outcome-status').textContent = `Could not save routing: ${error.message}`;
  }
});

document.querySelector('#prepare-ai')?.addEventListener('click', () => {
  showToast('Live AI automation is not connected. Use the draft and conversation preview controls for now.');
});

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem('black-glove-marketing-theme', theme);
  document.querySelector('#settings-theme').textContent = `Use ${theme === 'dark' ? 'light' : 'dark'} mode`;
  const appearance = document.querySelector('#appearance-current');
  if (appearance) appearance.textContent = `${theme === 'dark' ? 'Dark' : 'Light'} appearance`;
}
function toggleTheme() { setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'); }

document.querySelector('#load-team').addEventListener('click', async () => {
  const output = document.querySelector('#team-output'); output.textContent = 'Loading…';
  try { const data = await readResponse(await api('/api/admin/users')); output.textContent = data.users.map((user) => `${user.username || user.email} - ${user.role}`).join('\n'); }
  catch (error) { output.textContent = error.message; }
});
document.querySelector('#load-pipeline').addEventListener('click', async () => {
  const output = document.querySelector('#pipeline-output'); output.textContent = 'Loading…';
  try { const data = await readResponse(await api('/api/ghl/pipelines')); document.querySelector('#pipeline-editor').value = JSON.stringify(data, null, 2); output.textContent = 'Loaded. Review the workflow before saving.'; }
  catch (error) { output.textContent = error.message; }
});
document.querySelector('#save-pipeline').addEventListener('click', async () => {
  const output = document.querySelector('#pipeline-output');
  let body;
  try { body = JSON.parse(document.querySelector('#pipeline-editor').value); }
  catch { output.textContent = 'Workflow data must be valid JSON.'; return; }
  output.textContent = 'Saving…';
  try { await readResponse(await api('/api/ghl/pipelines', { method: 'PUT', body: JSON.stringify(body) })); output.textContent = 'Workflow changes saved.'; }
  catch (error) { output.textContent = error.message; }
});

const testOutput = document.querySelector('#test-lead-output');
async function refreshTestLeads() {
  testOutput.textContent = 'Loading…';
  try {
    const data = await readResponse(await api('/api/test-leads'));
    testOutput.textContent = data.testLeads.length ? data.testLeads.map((lead) => `${lead.crm}: ${lead.external_id} (${lead.label})`).join('\n') : 'No test records registered.';
  } catch (error) { testOutput.textContent = error.message; }
}
document.querySelector('#refresh-test-leads').addEventListener('click', refreshTestLeads);
document.querySelector('#register-test-lead').addEventListener('click', async () => {
  testOutput.textContent = 'Registering…';
  const body = { crm: document.querySelector('#test-crm').value, externalId: document.querySelector('#test-record-id').value.trim(), label: document.querySelector('#test-record-label').value.trim() };
  try { await readResponse(await api('/api/test-leads', { method: 'POST', body: JSON.stringify(body) })); await refreshTestLeads(); showToast('Test record registered'); }
  catch (error) { testOutput.textContent = error.message; }
});
document.querySelector('#create-sync-approval').addEventListener('click', async () => {
  const crm = document.querySelector('#test-crm').value;
  const externalId = document.querySelector('#test-record-id').value.trim();
  const firstName = document.querySelector('#test-first-name').value.trim();
  const lastName = document.querySelector('#test-last-name').value.trim();
  const email = document.querySelector('#test-email').value.trim();
  if (!externalId || (!firstName && !lastName && !email)) { testOutput.textContent = 'Register the test record and provide at least one test field before requesting approval.'; return; }
  const lead = crm === 'highlevel' ? { opportunityId: externalId } : { contactId: externalId };
  if (firstName) lead.firstName = firstName;
  if (lastName) lead.lastName = lastName;
  if (email) lead.email = email;
  testOutput.textContent = 'Creating approval request…';
  try {
    const data = await readResponse(await api('/api/approvals', { method: 'POST', body: JSON.stringify({ kind: 'sync', payload: { destination: crm, leads: [lead] } }) }));
    testOutput.textContent = `Sync request ${data.approval.id} is pending. It cannot run until approved and the CRM confirms the record is open.`;
    await refreshApprovals();
  } catch (error) { testOutput.textContent = error.message; }
});

const approvalList = document.querySelector('#approval-list');
async function runSync(approvalId, destination, execute, output) {
  output.textContent = execute ? 'Verifying and syncing…' : 'Checking live CRM status…';
  try {
    const data = await readResponse(await api('/api/sync', { method: 'POST', body: JSON.stringify({ approvalId, destination, execute }) }));
    output.textContent = execute ? `Sync completed for ${data.results.length} test record(s).` : `${data.eligible} test record(s) confirmed open; no CRM records changed.`;
  } catch (error) { output.textContent = error.message; }
}
async function refreshApprovals() {
  approvalList.replaceChildren(document.createTextNode('Loading…'));
  try {
    const data = await readResponse(await api('/api/approvals'));
    approvalList.replaceChildren();
    if (!data.approvals.length) { approvalList.textContent = 'No approvals yet.'; return; }
    data.approvals.forEach((approval) => {
      const item = document.createElement('article'); item.className = 'approval-item';
      const heading = document.createElement('strong'); heading.textContent = `${approval.kind} · ${approval.status}`;
      const detail = document.createElement('small'); detail.textContent = approval.kind === 'sync' ? `${approval.payload.destination} test-record request · ${approval.payload.leads?.length || 0} record(s)` : `${approval.payload.audience || approval.payload.provider || 'Review request'}`;
      const result = document.createElement('small'); result.className = 'approval-result';
      item.append(heading, detail);
      if (approval.status === 'pending') {
        for (const decision of ['approved', 'rejected']) {
          const button = document.createElement('button'); button.className = 'secondary'; button.type = 'button'; button.textContent = decision === 'approved' ? 'Approve' : 'Reject';
          button.addEventListener('click', async () => {
            result.textContent = 'Saving decision…';
            try { await readResponse(await api('/api/approvals', { method: 'PUT', body: JSON.stringify({ id: approval.id, status: decision }) })); await refreshApprovals(); }
            catch (error) { result.textContent = error.message; }
          });
          item.append(button);
        }
      }
      if (approval.kind === 'sync' && approval.status === 'approved') {
        for (const [label, execute] of [['Dry run', false], ['Sync test record', true]]) {
          const button = document.createElement('button'); button.className = 'secondary'; button.type = 'button'; button.textContent = label;
          button.addEventListener('click', () => {
            if (execute && !window.confirm('This updates the registered test record in the selected CRM. No messages or emails are sent. Continue?')) return;
            runSync(approval.id, approval.payload.destination, execute, result);
          });
          item.append(button);
        }
      }
      item.append(result);
      approvalList.append(item);
    });
  } catch (error) { approvalList.textContent = error.message; }
}
document.querySelector('#refresh-approvals').addEventListener('click', refreshApprovals);

const profileTrigger = document.querySelector('#profile-trigger');
const profileDropdown = document.querySelector('#profile-dropdown');
const appearanceToggle = document.querySelector('#toggle-appearance');
const appearanceSubmenu = document.querySelector('#appearance-submenu');
function closeProfileMenu() {
  profileDropdown.hidden = true;
  profileTrigger.setAttribute('aria-expanded', 'false');
  appearanceSubmenu.hidden = true;
  appearanceToggle.setAttribute('aria-expanded', 'false');
}
profileTrigger.addEventListener('click', () => {
  const open = profileTrigger.getAttribute('aria-expanded') === 'true';
  profileTrigger.setAttribute('aria-expanded', String(!open));
  profileDropdown.hidden = open;
  if (open) {
    appearanceSubmenu.hidden = true;
    appearanceToggle.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.profile-menu')) {
    closeProfileMenu();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeProfileMenu();
  }
});
function openSettings({ focusAppearance = false } = {}) {
  closeProfileMenu();
  document.querySelector('#settings-crm').value = crmDestination.value;
  document.querySelector('#settings-theme').textContent = `Use ${document.body.dataset.theme === 'dark' ? 'light' : 'dark'} mode`;
  document.querySelector('#settings-dialog').showModal();
  if (focusAppearance) document.querySelector('#settings-theme').focus({ preventScroll: true });
}
document.querySelector('#open-profile').addEventListener('click', () => {
  closeProfileMenu();
  document.querySelector('#profile-dialog').showModal();
});
document.querySelector('#open-inbox').addEventListener('click', () => {
  closeProfileMenu();
  document.querySelector('#conversations').scrollIntoView({ behavior: motionPreference.matches ? 'auto' : 'smooth', block: 'start' });
});
document.querySelector('#open-settings').addEventListener('click', () => openSettings());
appearanceToggle.addEventListener('click', () => {
  const open = appearanceToggle.getAttribute('aria-expanded') === 'true';
  appearanceToggle.setAttribute('aria-expanded', String(!open));
  appearanceSubmenu.hidden = open;
});
document.querySelector('#open-appearance-settings').addEventListener('click', () => openSettings({ focusAppearance: true }));
document.querySelector('#profile-to-settings').addEventListener('click', () => {
  document.querySelector('#profile-dialog').close();
  openSettings();
});
document.querySelector('#settings-theme').addEventListener('click', toggleTheme);
document.querySelector('#settings-dialog .settings-save').addEventListener('click', () => {
  crmDestination.value = document.querySelector('#settings-crm').value;
  localStorage.setItem('black-glove-marketing-crm', crmDestination.value);
  showToast('Workspace settings saved');
});
document.querySelector('#logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  location.replace('./');
});

const sections = [...document.querySelectorAll('.operations-main > section[id]')];
const navLinks = [...document.querySelectorAll('.operations-sidebar nav a')];
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) navLinks.forEach((link) => link.classList.toggle('active', link.hash === `#${visible.target.id}`));
  }, { rootMargin: '-18% 0px -65% 0px', threshold: [0, .2, .6] });
  sections.forEach((section) => observer.observe(section));
}

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !motionPreference.matches) {
  const revealItems = [
    ...document.querySelectorAll('.operations-heading, .ops-metrics article, .operations-section:not([hidden]), .operations-footer')
  ];
  revealItems.forEach((item, index) => {
    item.classList.add('motion-reveal');
    if (item.matches('.ops-metrics article')) item.style.setProperty('--motion-delay', `${(index % 4) * 75}ms`);
  });
  document.body.classList.add('motion-ready');

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
  revealItems.forEach((item) => revealObserver.observe(item));

  let motionFrame = 0;
  const updateSceneDepth = () => {
    motionFrame = 0;
    const depth = Math.max(-22, Math.min(0, -window.scrollY * 0.018));
    document.body.style.setProperty('--scroll-depth', `${depth.toFixed(1)}px`);
  };
  window.addEventListener('scroll', () => {
    if (!motionFrame) motionFrame = requestAnimationFrame(updateSceneDepth);
  }, { passive: true });
  updateSceneDepth();

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (event) => {
      if (motionFrame) return;
      motionFrame = requestAnimationFrame(() => {
        motionFrame = 0;
        const x = ((event.clientX / window.innerWidth) - 0.5) * 8;
        const y = ((event.clientY / window.innerHeight) - 0.5) * 8;
        document.body.style.setProperty('--scene-x', `${x.toFixed(1)}px`);
        document.body.style.setProperty('--scene-y', `${y.toFixed(1)}px`);
      });
    }, { passive: true });
  }

  motionPreference.addEventListener?.('change', (event) => {
    if (event.matches) {
      document.body.classList.remove('motion-ready');
      document.body.style.removeProperty('--scene-x');
      document.body.style.removeProperty('--scene-y');
      document.body.style.removeProperty('--scroll-depth');
    }
  });
}

setTheme(localStorage.getItem('black-glove-marketing-theme') || 'dark');

const connectorResults = document.querySelectorAll('.connector-result');
const mobileNavigation = document.querySelector('.operations-sidebar');
if (connectorResults.length && mobileNavigation && 'MutationObserver' in window) {
  const revealConnectorResult = (result) => requestAnimationFrame(() => {
    if (window.innerWidth > 720) return;
    const navTop = mobileNavigation.getBoundingClientRect().top;
    const resultBottom = result.getBoundingClientRect().bottom;
    const clearance = 12;
    if (resultBottom > navTop - clearance) {
      window.scrollBy({
        top: resultBottom - navTop + clearance,
        behavior: motionPreference.matches ? 'auto' : 'smooth'
      });
    }
  });
  connectorResults.forEach((result) => {
    new MutationObserver(() => revealConnectorResult(result)).observe(result, {
      childList: true,
      characterData: true,
      subtree: true
    });
  });
}
