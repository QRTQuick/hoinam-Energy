import { logoutUser } from "./firebase.js";
import { clearCachedProfile, getCachedProfile, getCartCount } from "./store.js";

function initialsFromName(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "HE";
}

export function formatMoney(amount, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(amount || 0));
}

export function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function statusBadge(status) {
  return `<span class="status-badge" data-status="${status || "pending"}">${status || "pending"}</span>`;
}

export function productMedia(product, className = "product-media") {
  const fallback = `<div class="fallback-mark">${initialsFromName(product.name)}</div>`;
  const image = product.image_url
    ? `<img src="${product.image_url}" alt="${product.name}">`
    : fallback;
  return `<div class="${className}">${image}</div>`;
}

export function renderProductCard(product) {
  return `
    <article class="product-card">
      ${productMedia(product)}
      <div class="product-card-body">
        <div class="chip-row">
          <span class="chip">${product.category || "EcoFlow"}</span>
          <span class="stock-pill">${product.stock} in stock</span>
        </div>
        <h3>${product.name}</h3>
        <p class="product-summary">${product.summary || "Reliable solar and backup power from Hoinam Energy."}</p>
        <div class="product-meta">
          <strong class="price">${formatMoney(product.price, product.currency)}</strong>
          <a class="button button-ghost" href="/product-detail.html?id=${product.id}"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> View</a>
        </div>
      </div>
    </article>
  `;
}

export function showToast(message, type = "info") {
  let root = document.querySelector(".toast-root");
  if (!root) {
    root = document.createElement("div");
    root.className = "toast-root";
    document.body.append(root);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  root.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

export function renderOffices() {
  const offices = window.HOINAM_CONFIG?.company?.offices || [];
  return offices
    .map(
      (office) => `
        <article class="office-card">
          <span class="badge">${office.title}</span>
          <h3>${office.title}</h3>
          <p class="muted">${office.address}</p>
        </article>
      `
    )
    .join("");
}

function renderFooterOffices() {
  const offices = window.HOINAM_CONFIG?.company?.offices || [];
  return `
    <article class="footer-panel">
      <span class="badge"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> Offices</span>
      <h3>Office locations</h3>
      <div class="footer-stack">
        ${offices
          .map(
            (office) => `
              <div class="footer-item">
                <strong>${office.title}</strong>
                <p class="muted">${office.address}</p>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderFooterFaq() {
  const faqItems = window.HOINAM_CONFIG?.company?.faq || [];
  return `
    <article class="footer-panel">
      <span class="badge"><i class="fa-solid fa-circle-question" aria-hidden="true"></i> FAQ</span>
      <h3>Common questions</h3>
      <div class="footer-stack">
        ${faqItems
          .slice(0, 4)
          .map(
            (item) => `
              <a class="footer-link" href="/about.html#faq">
                <strong>${item.question}</strong>
              </a>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderFooterSocials() {
  const socials = window.HOINAM_CONFIG?.company?.socials || [];
  return `
    <article class="footer-panel">
      <span class="badge"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Socials</span>
      <h3>Company socials</h3>
      <div class="social-links">
        ${socials
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
          .join("")}
      </div>
    </article>
  `;
}

export function injectShell(activePage) {
  const company = window.HOINAM_CONFIG?.company || {
    name: "Hoinam Energy",
    tagline: "Solar power installation and EcoFlow energy systems"
  };

  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  const active = (page) => (activePage === page ? "is-active" : "");

  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="container nav-row">
          <a class="brand" href="/index.html">
            <span class="brand-mark"><i class="fa-solid fa-solar-panel" aria-hidden="true"></i></span>
            <span class="brand-copy">
              <span>${company.name}</span>
              <small>${company.tagline}</small>
            </span>
          </a>
          <button class="nav-toggle" type="button" aria-label="Toggle navigation"><i class="fa-solid fa-bars" aria-hidden="true"></i> Menu</button>
          <nav class="site-nav" id="site-nav">
            <a class="nav-link ${active("home")}" href="/index.html"><i class="fa-solid fa-house" aria-hidden="true"></i><span>Home</span></a>
            <a class="nav-link ${active("about")}" href="/about.html"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>About</span></a>
            <a class="nav-link ${active("products")}" href="/products.html"><i class="fa-solid fa-battery-three-quarters" aria-hidden="true"></i><span>Products</span></a>
            <a class="nav-link ${active("install")}" href="/book-install.html"><i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i><span>Install</span></a>
            <a class="nav-link ${active("contact")}" href="/contact.html"><i class="fa-solid fa-headset" aria-hidden="true"></i><span>Contact</span></a>
            <a class="nav-link ${active("dashboard")} hidden" data-dashboard-link href="/dashboard.html"><i class="fa-solid fa-gauge-high" aria-hidden="true"></i><span>Dashboard</span></a>
            <a class="nav-link ${active("admin")} hidden" data-admin-link href="/admin.html"><i class="fa-solid fa-user-shield" aria-hidden="true"></i><span>Admin</span></a>
            <a class="nav-pill ${active("cart")}" href="/cart.html"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> Cart <span data-cart-count>0</span></a>
            <a class="nav-pill ${active("login")}" data-login-link href="/login.html"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Login</a>
            <a class="nav-pill ${active("register")}" data-register-link href="/register.html"><i class="fa-solid fa-user-plus" aria-hidden="true"></i> Register</a>
            <button class="nav-pill button-ghost hidden" type="button" data-logout-button>Logout</button>
          </nav>
        </div>
      </header>
    `;
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid footer-grid-wide">
            <article class="footer-panel">
              <span class="badge"><i class="fa-solid fa-solar-panel" aria-hidden="true"></i> About Hoinam</span>
              <h3>${company.name}</h3>
              <p class="muted">${company.about || `${company.tagline}. We combine EcoFlow product sales with installation planning for homes, offices, and commercial energy resilience.`}</p>
              <a class="button button-ghost" href="/about.html"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i> Read more</a>
            </article>
            ${renderFooterOffices()}
            ${renderFooterFaq()}
            ${renderFooterSocials()}
          </div>
        </div>
      </footer>
    `;
  }

  document.querySelector(".nav-toggle")?.addEventListener("click", () => {
    document.getElementById("site-nav")?.classList.toggle("is-open");
  });

  document.querySelector("[data-logout-button]")?.addEventListener("click", async () => {
    await logoutUser();
    clearCachedProfile();
    refreshShell();
    showToast("You have been signed out.", "success");
    window.location.href = "/login.html";
  });

  refreshShell();
}

export function refreshShell() {
  const profile = getCachedProfile();
  const cartCount = getCartCount();

  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(cartCount);
  });

  const authLink = document.querySelector("[data-auth-link]");
  const loginLink = document.querySelector("[data-login-link]");
  const registerLink = document.querySelector("[data-register-link]");
  const logoutButton = document.querySelector("[data-logout-button]");
  const dashboardLink = document.querySelector("[data-dashboard-link]");
  const adminLink = document.querySelector("[data-admin-link]");

  if (profile) {
    authLink?.classList.add("hidden");
    loginLink?.classList.add("hidden");
    registerLink?.classList.add("hidden");
    logoutButton?.classList.remove("hidden");
    dashboardLink?.classList.remove("hidden");
    if (profile.role === "admin") {
      adminLink?.classList.remove("hidden");
    } else {
      adminLink?.classList.add("hidden");
    }
  } else {
    authLink?.classList.remove("hidden");
    loginLink?.classList.remove("hidden");
    registerLink?.classList.remove("hidden");
    logoutButton?.classList.add("hidden");
    dashboardLink?.classList.add("hidden");
    adminLink?.classList.add("hidden");
  }
}
