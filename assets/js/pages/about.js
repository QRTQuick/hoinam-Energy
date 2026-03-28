import { bootstrapPage } from "../app-shell.js";
import { refreshInteractions } from "../interactions.js";
import { renderOffices } from "../ui.js";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function renderFaqCards() {
  const faqItems = window.HOINAM_CONFIG?.company?.faq || [];
  return faqItems
    .map(
      (item) => `
        <details class="panel faq-card">
          <summary class="faq-toggle">
            <span>${item.question}</span>
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
          </summary>
          <div class="faq-answer">
            <p class="muted">${item.answer}</p>
          </div>
        </details>
      `
    )
    .join("");
}

function renderSocialCards() {
  const socials = window.HOINAM_CONFIG?.company?.socials || [];
  return socials
    .map((social) =>
      social.href
        ? `
          <a class="social-link" href="${social.href}" target="_blank" rel="noreferrer">
            <i class="${social.icon}" aria-hidden="true"></i>
            <span>${social.label}</span>
          </a>
        `
        : `
          <span class="social-link is-disabled">
            <i class="${social.icon}" aria-hidden="true"></i>
            <span>${social.label}</span>
          </span>
        `
    )
    .join("");
}

function typeHeading(element) {
  if (!element || element.dataset.typingReady === "1") {
    return;
  }

  const fullText = element.dataset.typingText || element.textContent.trim();
  element.dataset.typingReady = "1";
  element.setAttribute("aria-label", fullText);

  if (prefersReducedMotion.matches) {
    element.textContent = fullText;
    element.classList.add("is-typed");
    return;
  }

  element.textContent = "";
  element.classList.add("is-typing");

  let index = 0;
  const step = () => {
    index += 1;
    element.textContent = fullText.slice(0, index);

    if (index < fullText.length) {
      window.setTimeout(step, 42);
      return;
    }

    element.classList.remove("is-typing");
    element.classList.add("is-typed");
  };

  window.setTimeout(step, 220);
}

async function init() {
  await bootstrapPage("about");

  const company = window.HOINAM_CONFIG?.company || {};

  const aboutCopy = document.getElementById("about-company-copy");
  const officeTarget = document.getElementById("about-offices");
  const faqTarget = document.getElementById("about-faq");
  const socialTarget = document.getElementById("about-socials");
  const typedHeading = document.querySelector("[data-typing-text]");

  if (aboutCopy) {
    aboutCopy.textContent =
      company.about ||
      "Hoinam Energy combines product sales with installation planning for customers that need dependable solar and backup power systems.";
  }

  if (officeTarget) {
    officeTarget.innerHTML = renderOffices();
    refreshInteractions(officeTarget);
  }

  if (faqTarget) {
    faqTarget.innerHTML = renderFaqCards();
    refreshInteractions(faqTarget);
  }

  if (socialTarget) {
    socialTarget.innerHTML = renderSocialCards();
    refreshInteractions(socialTarget);
  }

  typeHeading(typedHeading);
}

init();
