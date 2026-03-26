import { bootstrapPage } from "../app-shell.js";
import { renderOffices } from "../ui.js";

function renderFaqCards() {
  const faqItems = window.HOINAM_CONFIG?.company?.faq || [];
  return faqItems
    .map(
      (item) => `
        <article class="panel faq-card">
          <h3>${item.question}</h3>
          <p class="muted">${item.answer}</p>
        </article>
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

async function init() {
  await bootstrapPage("about");

  const company = window.HOINAM_CONFIG?.company || {};

  const aboutCopy = document.getElementById("about-company-copy");
  const officeTarget = document.getElementById("about-offices");
  const faqTarget = document.getElementById("about-faq");
  const socialTarget = document.getElementById("about-socials");

  if (aboutCopy) {
    aboutCopy.textContent =
      company.about ||
      "Hoinam Energy combines product sales with installation planning for customers that need dependable solar and backup power systems.";
  }

  if (officeTarget) {
    officeTarget.innerHTML = renderOffices();
  }

  if (faqTarget) {
    faqTarget.innerHTML = renderFaqCards();
  }

  if (socialTarget) {
    socialTarget.innerHTML = renderSocialCards();
  }
}

init();
