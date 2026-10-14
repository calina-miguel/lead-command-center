const API = 'https://lead-command-center-phi.vercel.app';
const params = new URLSearchParams(location.search);
const session = params.get('session') || sessionStorage.getItem('bg_session');
if(params.has('session')){sessionStorage.setItem('bg_session',session);history.replaceState({},'',location.pathname+location.hash)}
const authHeaders = session ? {Authorization:`Bearer ${session}`} : {};
fetch(`${API}/api/me`,{credentials:'include',headers:authHeaders}).then(async response=>{if(!response.ok){location.href='./';return}const data=await response.json();document.querySelector('#signed-in-user').textContent=data.user.email;if(data.user?.role==='admin'){const panel=document.querySelector('#admin-controls');panel.hidden=false;document.querySelector('#admin-user').textContent=data.user.email;document.querySelector('.status').lastChild.textContent=' Admin workspace';}}).catch(()=>{location.href='./';});
const steps = [...document.querySelectorAll('.step')];
const status = document.querySelector('#campaign-status');
const detail = document.querySelector('#campaign-detail');
const bar = document.querySelector('#progress-bar');
const count = document.querySelector('#step-count');
const monitor = document.querySelector('#monitor-copy');
const toast = document.querySelector('#toast');
const crmDestination = document.querySelector('#crm-destination');
const campaignDialog = document.querySelector('#campaign-dialog');
const workflowCampaignButtons = [...document.querySelectorAll('[data-workflow-campaign]')];
const videoFile = document.querySelector('#video-file');
crmDestination.value = localStorage.getItem('black-glove-marketing-crm') || 'highlevel';
workflowCampaignButtons.forEach(button=>button.classList.toggle('selected',button.dataset.workflowCampaign===localStorage.getItem('black-glove-marketing-campaign-type')));
let current = 0;
const messages = [
  ['Campaign path selected', 'The workflow is ready for prospect outreach or agent recruiting.', 'The campaign audience is selected before source and CRM routing begin.'],
  ['Source selected', 'The supplying CRM or lead source is ready for review.', 'The workflow knows where the audience comes from and where approved records should go.'],
  ['Follow-up approved', 'Relevant campaign messaging is prepared for the next touchpoint.', 'Content and outreach remain behind review until an authorized user approves the action.'],
  ['CRM aligned', 'The approved record is ready for the selected destination.', 'Contact context, tags, stage, and next action stay aligned across the operating flow.']
];
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
function render(){const [title,desc,copy]=messages[current];status.textContent=title;detail.textContent=desc;monitor.textContent=copy;bar.style.width=`${((current+1)/steps.length)*100}%`;count.textContent=`Step ${current+1} of ${steps.length}`;steps.forEach((step,index)=>step.classList.toggle('active',index===current));}
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.action==='start-campaign'){campaignDialog.showModal();return}current=(current+1)%steps.length;render();showToast(messages[current][0]);document.querySelector('#workflow').scrollIntoView({behavior:'smooth',block:'center'})}));
function applyCampaignPath(path){localStorage.setItem('black-glove-marketing-campaign-type',path);sourcePath.value=path;document.querySelector('#content-audience').value=path;workflowCampaignButtons.forEach(item=>item.classList.toggle('selected',item.dataset.workflowCampaign===path));}
document.querySelectorAll('[data-campaign]').forEach(button=>button.addEventListener('click',()=>{const recruiting=button.dataset.campaign==='agents';campaignDialog.close();applyCampaignPath(button.dataset.campaign);showToast(recruiting?'Agent Recruitment selected':'Lead Outreach selected');}));
workflowCampaignButtons.forEach(button=>button.addEventListener('click',()=>{applyCampaignPath(button.dataset.workflowCampaign);showToast(button.dataset.workflowCampaign==='agents'?'Agent Recruitment selected':'Lead Outreach selected');}));
videoFile.addEventListener('change',()=>{document.querySelector('#video-status').textContent=videoFile.files[0]?`${videoFile.files[0].name} selected. Ready for staged clipping.`:'No video selected. Recording and clipping stay staged until approved.';});
document.querySelector('#queue-content').addEventListener('click',()=>{const destinations=[...document.querySelectorAll('.destination-list input:checked')].map(input=>input.value);if(!videoFile.files.length){showToast('Attach or record a video first');return}if(!destinations.length){showToast('Choose at least one destination');return}showToast('Content package queued for approval');});
document.querySelector('#theme-toggle').addEventListener('click',()=>{const dark=document.body.dataset.theme==='dark';const theme=dark?'light':'dark';document.body.dataset.theme=theme;localStorage.setItem('black-glove-marketing-theme',theme);document.querySelector('#theme-toggle').textContent=dark?'Dark':'Light';});
document.querySelector('#save-crm').addEventListener('click',()=>{localStorage.setItem('black-glove-marketing-crm',crmDestination.value);showToast(`${crmDestination.options[crmDestination.selectedIndex].text} selected as the first sync destination`);});
const sourcePath=document.querySelector('#source-path');
const leadSource=document.querySelector('#lead-source');
sourcePath.value=localStorage.getItem('black-glove-marketing-source-path')||'outreach';
leadSource.value=localStorage.getItem('black-glove-marketing-lead-source')||'boldtrail';
document.querySelector('#save-source').addEventListener('click',()=>{localStorage.setItem('black-glove-marketing-source-path',sourcePath.value);localStorage.setItem('black-glove-marketing-lead-source',leadSource.value);showToast(`${sourcePath.options[sourcePath.selectedIndex].text} source saved`);});
document.querySelector('#load-team').addEventListener('click',async()=>{const output=document.querySelector('#team-output');output.textContent='Loading...';const response=await fetch(`${API}/api/admin/users`,{credentials:'include',headers:authHeaders});const data=await response.json();output.textContent=response.ok?data.users.map(user=>`${user.username||user.email} - ${user.role}`).join('\\n'):(data.error||'Unable to load team access');});
document.querySelector('#load-pipeline').addEventListener('click',async()=>{const output=document.querySelector('#pipeline-output');output.textContent='Loading...';const response=await fetch(`${API}/api/ghl/pipelines`,{credentials:'include',headers:authHeaders});const data=await response.json();document.querySelector('#pipeline-editor').value=JSON.stringify(data,null,2);output.textContent=response.ok?'Loaded. Review the workflow before saving.':(data.error||'Unable to load pipeline');});
document.querySelector('#save-pipeline').addEventListener('click',async()=>{const output=document.querySelector('#pipeline-output');let body;try{body=JSON.parse(document.querySelector('#pipeline-editor').value)}catch{output.textContent='Workflow data must be valid JSON.';return}output.textContent='Saving...';const response=await fetch(`${API}/api/ghl/pipelines`,{method:'PUT',credentials:'include',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();output.textContent=response.ok?'Workflow changes saved.':(data.error||'Unable to save workflow changes');});
document.querySelector('#logout').addEventListener('click',async()=>{await fetch(`${API}/api/logout`,{method:'POST',credentials:'include',headers:authHeaders});sessionStorage.removeItem('bg_session');location.href='./';});
document.body.dataset.theme=localStorage.getItem('black-glove-marketing-theme')||'light';document.querySelector('#theme-toggle').textContent=document.body.dataset.theme==='dark'?'Light':'Dark';
render();
