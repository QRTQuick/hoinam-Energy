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
          <a class="button button-ghost" href="/product-detail.html?id=${product.id}">View</a>
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
            <span class="brand-mark">HE</span>
            <span class="brand-copy">
              <span>${company.name}</span>
              <small>${company.tagline}</small>
            </span>
          </a>
          <button class="nav-toggle" type="button" aria-label="Toggle navigation">Menu</button>
          <nav class="site-nav" id="site-nav">
            <a class="nav-link ${active("home")}" href="/index.html">Home</a>
            <a class="nav-link ${active("products")}" href="/products.html">Products</a>
            <a class="nav-link ${active("install")}" href="/book-install.html">Book Installation</a>
            <a class="nav-link ${active("contact")}" href="/contact.html">Contact</a>
            <a class="nav-link ${active("dashboard")} hidden" data-dashboard-link href="/dashboard.html">Dashboard</a>
            <a class="nav-link ${active("admin")} hidden" data-admin-link href="/admin.html">Admin</a>
            <a class="nav-pill ${active("cart")}" href="/cart.html">Cart <span data-cart-count>0</span></a>
            <a class="nav-pill ${active("login")}" data-auth-link href="/login.html">Login</a>
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
          <div class="footer-grid">
            <article class="office-card">
              <span class="badge">About Hoinam</span>
              <h3>${company.name}</h3>
              <p class="muted">${company.tagline}. We combine EcoFlow product sales with installation planning for homes, offices, and commercial energy resilience.</p>
            </article>
            ${renderOffices()}
          </div>
          <p class="footer-note">Clean energy storefront, booking, and admin workflow for Hoinam Energy.</p>
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
  const logoutButton = document.querySelector("[data-logout-button]");
  const dashboardLink = document.querySelector("[data-dashboard-link]");
  const adminLink = document.querySelector("[data-admin-link]");

  if (profile) {
    authLink?.classList.add("hidden");
    logoutButton?.classList.remove("hidden");
    dashboardLink?.classList.remove("hidden");
    if (profile.role === "admin") {
      adminLink?.classList.remove("hidden");
    } else {
      adminLink?.classList.add("hidden");
    }
  } else {
    authLink?.classList.remove("hidden");
    logoutButton?.classList.add("hidden");
    dashboardLink?.classList.add("hidden");
    adminLink?.classList.add("hidden");
  }
}
