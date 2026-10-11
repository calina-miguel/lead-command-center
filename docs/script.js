const titles = {
  overview: "Command Center",
  "hot-leads": "Hot Leads",
  content: "Content Approval",
  pipeline: "Pipeline",
  engine: "Under the Hood"
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
const contentVariants = [
  {
    subject: "Subject: A clearer path for your next move",
    email: "Hi Maya, I noticed your interest came through our buyer lead list, so I put together a simple next step: compare timing, budget fit, and available options without pressure. If useful, I can send a tailored update or help you book a short strategy call.",
    social: "Buyers do not need more noise. They need clear timing, useful options, and a next step that matches where they are in the process. We are helping active buyers move with clarity, not pressure.",
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
    email: "Hi Nina, based on your reply, the short version is this: we can help you compare options, understand timing, and decide whether a call is worth it. If you want, I can send the most relevant details first.",
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

function setView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    const isActive = view.id === viewName;
    view.classList.toggle("active", isActive);
    if (isActive && !reduceMotion) {
      view.getAnimations().forEach((animation) => animation.cancel());
      view.animate(
        [
          { opacity: 0, transform: "translateY(12px) scale(0.992)", filter: "blur(4px)" },
          { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)" }
        ],
        { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" }
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
  document.body.classList.toggle("has-scrolled", window.scrollY > 120);
  if (window.scrollY <= 120) {
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

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileMenu();
  }
});

window.addEventListener("scroll", updateScrolledState, { passive: true });
updateScrolledState();

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
