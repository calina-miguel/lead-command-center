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
