const titles = {
  overview: "Command Center",
  "hot-leads": "Hot Leads",
  content: "Content Approval",
  pipeline: "Pipeline",
  engine: "Under the Hood",
  setup: "Setup"
};

const walkthroughSteps = [
  {
    view: "overview",
    caption: "Open with the outcome: clients see leads, replies, calls, and follow-up coverage without needing to understand GHL."
  },
  {
    view: "hot-leads",
    caption: "Show the priority inbox: the system surfaces who needs attention now and what the next move should be."
  },
  {
    view: "content",
    caption: "Explain the safety layer: email, SMS, and social content wait for approval before sensitive outreach goes live."
  },
  {
    view: "pipeline",
    caption: "Connect activity to revenue: every lead has a pipeline stage and a next action."
  },
  {
    view: "engine",
    caption: "Then reveal the under-the-hood workflow engine in GHL: intake, reply routing, booked calls, and billing handoff."
  },
  {
    view: "setup",
    caption: "Close with implementation readiness: what is ready now, what is safely staged, and what needs partner approval."
  }
];

let currentStep = 0;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const themeToggle = document.querySelector("#theme-toggle");
const themeLabel = document.querySelector(".theme-label");
const themeIcon = document.querySelector(".theme-icon");
const mobileMenuToggle = document.querySelector("#mobile-menu-toggle");
const generateContentButton = document.querySelector("#generate-content");
const generatedOutput = document.querySelector("#generated-output");
const emailSubject = document.querySelector("#email-subject");
const emailCopy = document.querySelector("#email-copy");
const socialCopy = document.querySelector("#social-copy");
const tagCopy = document.querySelector("#tag-copy");
const creativeKicker = document.querySelector("#creative-kicker");
const creativeHeadline = document.querySelector("#creative-headline");
const creativeSubcopy = document.querySelector("#creative-subcopy");
const imageDirection = document.querySelector("#image-direction");
const imageGuidance = document.querySelector("#image-guidance");
const primaryCta = document.querySelector("#primary-cta");
const secondaryCta = document.querySelector("#secondary-cta");
const deploymentSummary = document.querySelector("#deployment-summary");
const contextTrigger = document.querySelector("#context-trigger");
const contextHint = document.querySelector("#context-hint");
const workflowToast = document.querySelector("#workflow-toast");
const contentVariants = [
  {
    subject: "Subject: A clearer path for your next move",
    email: "Hi Maya, I noticed your interest came through our buyer lead list, so I put together a simple next step: compare timing, budget fit, and available options without pressure. If useful, I can send a tailored update or book a short strategy call.",
    social: "Buyers do not need more noise. They need clear timing, useful options, and a next step that matches where they are in the process. We guide active buyers with clarity, not pressure.",
    tag: "Suggested tag action: avoid a public tag unless the prospect has already engaged publicly. Use a private message for personalized follow-up.",
    kicker: "Buyer Clarity",
    headline: "Move with a plan, not pressure.",
    subcopy: "A clear next step for active buyers comparing timing, options, and fit.",
    image: "Truthful visual: calm buyer planning dashboard",
    guidance: "Use lifestyle-neutral visuals, no exaggerated income/property claims, and no implication that results are guaranteed.",
    primary: "Book a SaaS Growth Strategy Call",
    secondary: "Request tailored information"
  },
  {
    subject: "Subject: Quick answer to your pricing question",
    email: "Hi Andre, your pricing question is exactly where a quick comparison helps. I can send a concise breakdown of what affects total cost, what to watch for, and which next step makes sense based on your timeline.",
    social: "A good buying decision starts with context: pricing, timing, and fit. The goal is not to rush the process. It is to remove uncertainty so the next step feels obvious.",
    tag: "Suggested tag action: if referencing a pricing question, keep it private. Do not tag the prospect publicly around financial intent.",
    kicker: "Price Context",
    headline: "Know what affects the number.",
    subcopy: "Useful pricing context without pressure, hidden terms, or exaggerated promises.",
    image: "Truthful visual: clean pricing checklist with neutral housing imagery",
    guidance: "Do not imply discounts, guaranteed savings, or guaranteed availability. Keep numbers contextual and verifiable.",
    primary: "Compare options on a call",
    secondary: "Send me the pricing checklist"
  },
  {
    subject: "Subject: Want the short version?",
    email: "Hi Nina, based on your reply, the short version is this: we can compare options, clarify timing, and decide whether a call is worth it. If you want, I can send the most relevant details first.",
    social: "The best follow-up is specific. When someone shows interest, the next message should match their source, question, and timing instead of sending the same generic pitch.",
    tag: "Suggested tag action: public tagging is only recommended when the post is educational, relevant, and connected to prior consent or public engagement.",
    kicker: "Specific Follow-Up",
    headline: "Relevant beats generic.",
    subcopy: "A sharper next step based on source, question, and timing.",
    image: "Truthful visual: personalized follow-up cards organized by intent",
    guidance: "Avoid using personal details publicly. Keep audience examples anonymized unless explicit consent exists.",
    primary: "See the relevant next step",
    secondary: "Ask for a personalized update"
  }
];
let contentVariantIndex = 0;
let activeSummaryTarget = null;
let helpHideTimer = null;
let helpIdleTimer = null;
let toastTimer = null;
const tapMotionSelector = [
  "button",
  ".metric",
  ".panel",
  ".approval-card",
  ".lead-row:not(.header)",
  ".journey-step",
  ".task-row",
  ".studio-card",
  ".output-card",
  ".creative-card",
  ".composer-card",
  ".lane",
  ".deal",
  ".engine-flow article",
  ".screenshot-strip figure",
  ".setup-card",
  ".setup-runbook",
  ".connection-row:not(.header)",
  ".connection-table"
].join(",");

const contextSummaries = new Map([
  ["[data-view='overview']", "Command Center shows the top-level operating dashboard: lead volume, hot replies, booked calls, coverage, video walkthrough, journey, and priority queue."],
  ["[data-view='hot-leads']", "Hot Leads opens the priority inbox so the team can focus on prospects with strong buying signals or urgent questions."],
  ["[data-view='content']", "Content Approval opens the messaging studio where emails, social copy, media direction, CTAs, and deployment settings are reviewed before publishing."],
  ["[data-view='pipeline']", "Pipeline shows where each opportunity sits from new lead through booked call, proposal, and closed-won billing handoff."],
  ["[data-view='engine']", "Under the Hood explains the workflow logic behind intake, routing, approvals, call preparation, and billing setup."],
  ["[data-view='setup']", "Setup shows which integrations are ready now, which ones are staged safely, and what credentials are still needed for production."],
  ["#mobile-menu-toggle", "Opens the compact navigation menu on mobile so users can jump between workspace sections."],
  ["#theme-toggle", "Switches the workspace between light and dark mode."],
  ["#prev-step", "Moves the guided walkthrough back one step."],
  ["#next-step", "Advances the guided walkthrough to the next section."],
  ["#generate-content", "Builds a fresh compliant outreach set: email, social copy, CTA language, tag guidance, and image direction."],
  ["[data-view-jump='engine']", "Jumps directly to the workflow engine view for the automation logic behind this dashboard."],
  ["[data-view-jump='hot-leads']", "Jumps to the leads that need the fastest reply."],
  ["[data-view-jump='content']", "Jumps to content drafts waiting for review and approval."],
  ["[data-view-jump='pipeline']", "Jumps to scheduled calls and opportunity stages."],
  [".presentation-panel", "Video walkthrough of the system: lead intake, priorities, content approval, pipeline movement, and workflow handoff."],
  [".metric", "Snapshot metric showing current operating status for leads, replies, calls, or follow-up coverage."],
  [".journey-step", "Workflow stage showing how a lead moves from intake through response, booking, closing, billing, and onboarding."],
  [".task-row", "Priority action shortcut that opens the relevant workspace section."],
  [".approval-card", "Review card for outbound messaging before it is approved for use."],
  [".studio-card", "Input module that defines targeting, offer angle, compliance checks, and audience preferences for prepared content."],
  [".output-card", "Prepared outreach output ready for review, edits, or approval."],
  [".creative-card", "Prepared creative direction for visual assets, CTA language, and compliant campaign presentation."],
  [".composer-card", "Deployment setting for choosing format, platform, media attachment, and emoji tone."],
  [".lane", "Pipeline lane grouping opportunities by current revenue stage."],
  [".engine-flow article", "Automation node showing what the operating workflow does at this stage."],
  [".setup-card", "Implementation card showing whether this workflow area is ready to configure or safely staged for later approval."],
  [".setup-runbook", "Safe operating plan for testing the full workflow without live sends, real charges, or unintended account changes."],
  [".connection-table", "Credential checklist for moving each workflow area from staged setup into production."]
]);

function assignContextSummaries() {
  contextSummaries.forEach((summary, selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (!element.dataset.summary) element.dataset.summary = summary;
    });
  });

  document.querySelectorAll(".primary-button, .ghost-button, .card-actions button, .option-pill, .platform-pill, .emoji-pill").forEach((button) => {
    if (button.dataset.summary) return;

    const label = button.textContent.trim();
    const group = button.closest("[data-option-group]")?.dataset.optionGroup;
    if (group === "format") {
      button.dataset.summary = `Selects ${label} as the publishing format for the approved content.`;
    } else if (group === "platforms") {
      button.dataset.summary = `Toggles ${label} as a deployment destination for this content.`;
    } else if (group === "emoji") {
      button.dataset.summary = `Sets the message tone to ${label}.`;
    } else if (label) {
      button.dataset.summary = `${label}: runs this action in the current workflow section.`;
    }
  });

  document.querySelectorAll("section, article, figure").forEach((element) => {
    if (element.dataset.summary) return;
    const heading = element.querySelector("h3, h4, figcaption, strong")?.textContent.trim();
    const copy = element.querySelector("p, span")?.textContent.trim();
    if (heading && copy) {
      element.dataset.summary = `${heading}: ${copy}`;
    }
  });
}

function hintPositionFor() {
  const rect = contextTrigger.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 28);
  let x = rect.left + rect.width / 2 - width / 2;
  let y = rect.bottom + 10;

  x = Math.max(14, Math.min(x, window.innerWidth - width - 14));
  if (y > window.innerHeight - 120) y = Math.max(14, rect.top - 108);
  return { x, y };
}

function triggerPositionFor(element) {
  const rect = element.getBoundingClientRect();
  let x = rect.right - 18;
  let y = rect.top - 10;

  if (rect.width < 60) {
    x = rect.right + 8;
    y = rect.top + rect.height / 2 - 16;
  }

  x = Math.max(12, Math.min(x, window.innerWidth - 44));
  y = Math.max(12, Math.min(y, window.innerHeight - 44));
  return { x, y };
}

function showContextTrigger(element) {
  if (!contextTrigger || !element?.dataset?.summary) return;

  clearTimeout(helpHideTimer);
  clearContextIdleTimer();
  activeSummaryTarget = element;
  const { x, y } = triggerPositionFor(element);
  contextTrigger.style.setProperty("--help-x", `${Math.round(x)}px`);
  contextTrigger.style.setProperty("--help-y", `${Math.round(y)}px`);
  contextTrigger.classList.add("is-visible");
  scheduleContextIdleHide();
}

function showContextHint(element = activeSummaryTarget) {
  if (!contextHint || !element?.dataset?.summary) return;

  clearTimeout(helpHideTimer);
  clearContextIdleTimer();
  const { x, y } = hintPositionFor();
  contextHint.textContent = element.dataset.summary;
  contextHint.style.setProperty("--hint-x", `${Math.round(x)}px`);
  contextHint.style.setProperty("--hint-y", `${Math.round(y)}px`);
  contextHint.classList.add("is-visible");
  scheduleContextIdleHide(4200);
}

function hideContextHint() {
  contextHint?.classList.remove("is-visible");
}

function hideContextHelp() {
  clearContextIdleTimer();
  activeSummaryTarget = null;
  contextTrigger?.classList.remove("is-visible");
  hideContextHint();
}

function clearContextIdleTimer() {
  clearTimeout(helpIdleTimer);
}

function scheduleContextIdleHide(delay = 2600) {
  clearContextIdleTimer();
  helpIdleTimer = setTimeout(() => {
    hideContextHelp();
  }, delay);
}

function queueContextHelpHide() {
  clearTimeout(helpHideTimer);
  helpHideTimer = setTimeout(() => {
    if (!contextTrigger?.matches(":hover, :focus-visible")) {
      hideContextHelp();
    }
  }, 180);
}

function closestSummaryTarget(target) {
  if (target === contextTrigger || contextTrigger?.contains(target)) return null;
  return target.closest("[data-summary]");
}

function closestTapTarget(target) {
  return target.closest(tapMotionSelector);
}

function pulseTapMotion(element) {
  if (reduceMotion || !element) return;
  element.classList.remove("is-tapping");
  void element.offsetWidth;
  element.classList.add("is-tapping");
  window.setTimeout(() => element.classList.remove("is-tapping"), 460);
}

function showWorkflowToast(message) {
  if (!workflowToast) return;
  clearTimeout(toastTimer);
  workflowToast.textContent = message;
  workflowToast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    workflowToast.classList.remove("is-visible");
  }, 3600);
}

function markElementState(element, state, label) {
  if (!element) return;
  element.dataset.workflowState = state;
  element.classList.remove("state-reviewing", "state-approved", "state-queued", "state-checked");
  element.classList.add(`state-${state}`);
  if (label) element.dataset.stateLabel = label;
}

function runContentGeneration() {
  generateContentButton?.click();
  document.querySelector(".content-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function runWorkflowAction(action, source) {
  const card = source.closest(".approval-card, .output-card, .deployment-composer, .setup-card, .setup-runbook");

  if (action === "prepare-outreach") {
    setView("content");
    window.setTimeout(runContentGeneration, 180);
    showWorkflowToast("Outreach package prepared and moved into content review.");
    return;
  }

  if (action === "approve-selected") {
    document.querySelectorAll(".approval-card").forEach((item) => {
      markElementState(item, "approved", "Approved");
    });
    showWorkflowToast("All visible content cards approved and ready for queueing.");
    return;
  }

  if (action === "review-card") {
    markElementState(card, "reviewing", "In review");
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    showWorkflowToast("Card opened for review. Compliance gate remains active.");
    return;
  }

  if (action === "approve-card") {
    markElementState(card, "approved", "Approved");
    showWorkflowToast("Card approved. It can now move to the deployment queue.");
    return;
  }

  if (action === "queue-review") {
    document.querySelectorAll(".output-card, .creative-card").forEach((item) => {
      markElementState(item, "queued", "Queued");
    });
    showWorkflowToast("Prepared email, social copy, image direction, and CTA moved to review queue.");
    return;
  }

  if (action === "queue-deployment") {
    markElementState(document.querySelector(".deployment-composer"), "queued", "Queued");
    updateDeploymentSummary();
    setView("pipeline");
    showWorkflowToast("Approved deployment queued. Pipeline updated for next action.");
    return;
  }

  if (action === "attach-media") {
    const mediaDrop = source.closest(".media-drop");
    mediaDrop?.classList.add("has-media");
    mediaDrop?.querySelector("span") && (mediaDrop.querySelector("span").textContent = "Creative attached");
    mediaDrop?.querySelector("p") && (mediaDrop.querySelector("p").textContent = "Approved image/video asset attached for controlled workflow validation.");
    showWorkflowToast("Media attachment added to the deployment package.");
    return;
  }

  if (action === "run-safe-check") {
    document.querySelectorAll(".setup-card, .setup-runbook, .connection-table").forEach((item) => {
      markElementState(item, "checked", "Checked");
    });
    showWorkflowToast("Safe check complete: live sends and billing remain gated until credentials are connected.");
  }
}

function updateDeploymentSummary() {
  if (!deploymentSummary) return;

  const format = document.querySelector('[data-option-group="format"] .active')?.textContent.trim() || "Post";
  const platforms = [...document.querySelectorAll('[data-option-group="platforms"] .active')]
    .map((button) => button.textContent.trim());
  const emojiTone = document.querySelector('[data-option-group="emoji"] .active')?.textContent.trim() || "Clear";
  const platformText = platforms.length ? platforms.join(", ") : "selected platforms";

  deploymentSummary.textContent = `${format} to ${platformText} with image/video attachment and ${emojiTone.toLowerCase()} tone.`;
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("lead-command-theme", theme);

  const isDark = theme === "dark";
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  themeLabel.textContent = isDark ? "Light" : "Dark";
  themeIcon.textContent = isDark ? "☼" : "☾";
}

const savedTheme = localStorage.getItem("lead-command-theme");
const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
applyTheme(savedTheme || preferredTheme);
assignContextSummaries();

function setView(viewName) {
  hideContextHelp();
  document.querySelectorAll(".view").forEach((view) => {
    const isActive = view.id === viewName;
    view.classList.toggle("active", isActive);
    if (isActive && !reduceMotion) {
      view.getAnimations().forEach((animation) => animation.cancel());
      view.animate(
        [
          { opacity: 0, transform: "translateY(16px) scale(0.985)", filter: "blur(8px)" },
          { opacity: 0.82, transform: "translateY(5px) scale(0.996)", filter: "blur(2px)", offset: 0.58 },
          { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)" }
        ],
        { duration: 680, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
    }
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  document.querySelector("#view-title").textContent = titles[viewName];
  closeMobileMenu();
}

function closeMobileMenu() {
  document.body.classList.remove("nav-open");
  mobileMenuToggle?.setAttribute("aria-expanded", "false");
  mobileMenuToggle?.setAttribute("aria-label", "Open menu");
}

function toggleMobileMenu() {
  const willOpen = !document.body.classList.contains("nav-open");
  document.body.classList.toggle("nav-open", willOpen);
  mobileMenuToggle?.setAttribute("aria-expanded", String(willOpen));
  mobileMenuToggle?.setAttribute("aria-label", willOpen ? "Close menu" : "Open menu");
}

function updateScrolledState() {
  const isAtTop = window.scrollY <= 8;
  document.body.classList.toggle("is-at-top", isAtTop);
  document.body.classList.toggle("has-scrolled", window.scrollY > 120);
  if (!isAtTop && window.scrollY <= 120) {
    closeMobileMenu();
  }
}

function setWalkthroughStep(index) {
  currentStep = (index + walkthroughSteps.length) % walkthroughSteps.length;
  const step = walkthroughSteps[currentStep];
  setView(step.view);
  document.querySelector("#flow-caption").textContent = step.caption;
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-view-jump]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewJump));
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => runWorkflowAction(button.dataset.action, button));
});

document.querySelectorAll('[data-option-group="format"] button, [data-option-group="emoji"] button').forEach((button) => {
  button.addEventListener("click", () => {
    button.parentElement.querySelectorAll("button").forEach((option) => option.classList.remove("active"));
    button.classList.add("active");
    updateDeploymentSummary();
  });
});

document.querySelectorAll('[data-option-group="platforms"] button').forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
    updateDeploymentSummary();
  });
});

document.querySelector("#next-step").addEventListener("click", () => {
  setWalkthroughStep(currentStep + 1);
});

document.querySelector("#prev-step").addEventListener("click", () => {
  setWalkthroughStep(currentStep - 1);
});

themeToggle.addEventListener("click", () => {
  applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
});

generateContentButton?.addEventListener("click", () => {
  contentVariantIndex = (contentVariantIndex + 1) % contentVariants.length;
  const variant = contentVariants[contentVariantIndex];
  emailSubject.textContent = variant.subject;
  emailCopy.textContent = variant.email;
  socialCopy.textContent = variant.social;
  tagCopy.textContent = variant.tag;
  creativeKicker.textContent = variant.kicker;
  creativeHeadline.textContent = variant.headline;
  creativeSubcopy.textContent = variant.subcopy;
  imageDirection.textContent = variant.image;
  imageGuidance.textContent = variant.guidance;
  primaryCta.textContent = variant.primary;
  secondaryCta.textContent = variant.secondary;
  generatedOutput?.classList.remove("is-refreshing");
  requestAnimationFrame(() => {
    generatedOutput?.classList.add("is-refreshing");
  });
});

mobileMenuToggle?.addEventListener("click", toggleMobileMenu);

document.addEventListener("pointerover", (event) => {
  const target = closestSummaryTarget(event.target);
  if (target) showContextTrigger(target);
});

document.addEventListener("pointerout", (event) => {
  const target = closestSummaryTarget(event.target);
  if (target && !target.contains(event.relatedTarget) && !contextTrigger?.contains(event.relatedTarget)) {
    queueContextHelpHide();
  }
});

document.addEventListener("focusin", (event) => {
  const target = closestSummaryTarget(event.target);
  if (target) showContextTrigger(target);
});

document.addEventListener("focusout", (event) => {
  const target = closestSummaryTarget(event.target);
  if (target && !target.contains(event.relatedTarget) && event.relatedTarget !== contextTrigger) {
    queueContextHelpHide();
  }
});

document.addEventListener("pointerdown", (event) => {
  pulseTapMotion(closestTapTarget(event.target));
  const target = closestSummaryTarget(event.target);
  if (target) showContextTrigger(target);
});

contextTrigger?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  showContextHint();
});

contextTrigger?.addEventListener("pointerover", () => {
  clearTimeout(helpHideTimer);
  clearContextIdleTimer();
});

contextTrigger?.addEventListener("pointerout", (event) => {
  if (!activeSummaryTarget?.contains(event.relatedTarget)) queueContextHelpHide();
  scheduleContextIdleHide();
});

contextHint?.addEventListener("pointerover", () => {
  clearContextIdleTimer();
});

contextHint?.addEventListener("pointerout", () => {
  scheduleContextIdleHide(1600);
});

document.addEventListener("click", (event) => {
  if (event.target === contextTrigger || contextTrigger?.contains(event.target)) return;
  if (!closestSummaryTarget(event.target)) hideContextHelp();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideContextHelp();
    closeMobileMenu();
  }
});

window.addEventListener("scroll", () => {
  updateScrolledState();
  hideContextHelp();
}, { passive: true });
updateScrolledState();
updateDeploymentSummary();

const params = new URLSearchParams(window.location.search);
const initialView = params.get("view");
if (initialView && titles[initialView]) {
  setView(initialView);
}

const focusTarget = params.get("focus");
if (focusTarget) {
  requestAnimationFrame(() => {
    document.querySelector(`#${focusTarget}, .${focusTarget}`)?.scrollIntoView({ block: "center" });
  });
}

if (!reduceMotion) {
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  window.addEventListener("pointermove", (event) => {
    targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  });

  function animateParallax() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    document.documentElement.style.setProperty("--mx", currentX.toFixed(3));
    document.documentElement.style.setProperty("--my", currentY.toFixed(3));
    requestAnimationFrame(animateParallax);
  }

  animateParallax();
}
