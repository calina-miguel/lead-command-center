const steps = [...document.querySelectorAll('.step')];
const status = document.querySelector('#campaign-status');
const detail = document.querySelector('#campaign-detail');
const bar = document.querySelector('#progress-bar');
const count = document.querySelector('#step-count');
const monitor = document.querySelector('#monitor-copy');
const toast = document.querySelector('#toast');
let current = 0;
const messages = [
  ['Lead captured', 'The new lead is organized with source and stated interest.', 'Intake is complete and the record is ready for campaign routing.'],
  ['Campaign started', 'The matching follow-up sequence is now active.', 'The lead has moved into the right campaign based on their marketing need.'],
  ['Email follow-up ready', 'A relevant message is prepared for the next touchpoint.', 'The follow-up keeps the conversation useful, timely, and connected to the lead’s need.'],
  ['CRM aligned', 'The GHL record is current and ready for optional native CRM sync.', 'Approved contact context, stage, and next action can stay aligned across systems.']
];
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
function render(){const [title,desc,copy]=messages[current];status.textContent=title;detail.textContent=desc;monitor.textContent=copy;bar.style.width=`${((current+1)/steps.length)*100}%`;count.textContent=`Step ${current+1} of ${steps.length}`;steps.forEach((step,index)=>step.classList.toggle('active',index===current));}
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{current=button.dataset.action==='start-campaign'?Math.min(1,steps.length-1):(current+1)%steps.length;render();showToast(messages[current][0]);document.querySelector('#workflow').scrollIntoView({behavior:'smooth',block:'center'})}));
document.querySelector('#theme-toggle').addEventListener('click',()=>{const dark=document.body.dataset.theme==='dark';const theme=dark?'light':'dark';document.body.dataset.theme=theme;localStorage.setItem('black-glove-marketing-theme',theme);document.querySelector('#theme-toggle').textContent=dark?'Dark':'Light';});
document.body.dataset.theme=localStorage.getItem('black-glove-marketing-theme')||'light';document.querySelector('#theme-toggle').textContent=document.body.dataset.theme==='dark'?'Light':'Dark';
render();
