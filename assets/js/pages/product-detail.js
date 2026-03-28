import { getProduct } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { addToCart } from "../store.js";
import { formatMoney, productMedia, refreshShell, showToast } from "../ui.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setText(id, value) {
  const target = document.getElementById(id);
  if (target) {
    target.textContent = value;
  }
}

function updateMetadata(product) {
  const title = `${product.name || "Product detail"} | Hoinam Energy`;
  const description = product.summary || product.description || "Explore specs, pricing, and availability for EcoFlow backup power systems.";

  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", description);
}

function updateHero(product) {
  setText("product-hero-eyebrow", product.category || "EcoFlow product");
  setText("product-hero-title", product.name || "Product overview");
  setText(
    "product-hero-summary",
    product.summary || "Review pricing, highlights, and next steps before adding to cart or booking installation."
  );
}

function getAvailability(stock) {
  if (stock > 0) {
    return {
      className: "is-in-stock",
      label: "In stock now",
      copy: `${stock} unit${stock === 1 ? "" : "s"} ready for checkout`
    };
  }

  return {
    className: "is-backorder",
    label: "Available on request",
    copy: "Ask for sourcing and delivery timing"
  };
}

function renderHighlights(product) {
  const highlights = (product.highlights || []).filter(Boolean);
  const items = highlights.length
    ? highlights
    : ["Solar-ready setup", "Installation support available", "Reliable backup planning"];

  return items
    .map(
      (item) => `
        <li>
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          <span>${escapeHtml(item)}</span>
        </li>
      `
    )
    .join("");
}

function renderDetail(product) {
  const stock = Number(product.stock || 0);
  const availability = getAvailability(stock);
  const description = product.description || product.summary || "Clean energy backup engineered for modern homes and businesses.";
  const category = product.category || "EcoFlow product";
  const primaryHighlight = (product.highlights || []).find(Boolean) || "Homes, shops, and business backup";
  const sku = product.sku || product.slug || "HOINAM";
  const stockPillText = stock > 0 ? `${stock} in stock` : "On request";

  return `
    <div class="detail-layout product-detail-layout">
      <article class="panel detail-card product-detail-media-card interactive-card">
        <div class="detail-card-top">
          <span class="detail-category-badge">${escapeHtml(category)}</span>
          <span class="detail-sku">SKU ${escapeHtml(sku)}</span>
        </div>
        ${productMedia(product, "product-media detail-product-media")}
        <div class="detail-card-facts">
          <div class="detail-fact-card">
            <span>Availability</span>
            <strong>${escapeHtml(availability.label)}</strong>
          </div>
          <div class="detail-fact-card">
            <span>Current price</span>
            <strong>${formatMoney(product.price, product.currency)}</strong>
          </div>
          <div class="detail-fact-card">
            <span>Best for</span>
            <strong>${escapeHtml(primaryHighlight)}</strong>
          </div>
        </div>
      </article>

      <article class="detail-copy">
        <section class="panel detail-summary-card">
          <span class="eyebrow"><i class="fa-solid fa-bolt" aria-hidden="true"></i> Ready for backup planning</span>
          <div class="detail-heading-stack">
            <h1>${escapeHtml(product.name)}</h1>
            <p class="detail-lead">${escapeHtml(description)}</p>
          </div>

          <div class="detail-price-row">
            <div>
              <p class="detail-label">Current price</p>
              <strong class="detail-price">${formatMoney(product.price, product.currency)}</strong>
            </div>
            <div class="detail-availability ${availability.className}">
              <span>${escapeHtml(availability.label)}</span>
              <strong>${escapeHtml(availability.copy)}</strong>
            </div>
          </div>

          <div class="chip-row detail-summary-meta">
            <span class="chip">${escapeHtml(category)}</span>
            <span class="stock-pill">${escapeHtml(stockPillText)}</span>
            <span class="badge">Secure checkout</span>
          </div>

          <div class="detail-action-grid">
            <button class="button" id="add-to-cart-button" type="button">
              <i class="fa-solid fa-cart-plus" aria-hidden="true"></i>
              <span>Add to cart</span>
            </button>
            <a class="button button-secondary" href="/book-install.html?productId=${product.id}">
              <i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i>
              <span>Book installation</span>
            </a>
          </div>

          <div class="detail-support-strip">
            <span><i class="fa-solid fa-truck-fast" aria-hidden="true"></i> Nationwide delivery</span>
            <span><i class="fa-solid fa-headset" aria-hidden="true"></i> Product guidance included</span>
            <span><i class="fa-solid fa-solar-panel" aria-hidden="true"></i> Solar pairing support</span>
          </div>
        </section>

        <div class="detail-info-grid">
          <section class="panel detail-panel">
            <h3><i class="fa-solid fa-star" aria-hidden="true"></i> Highlights</h3>
            <ul class="list-reset detail-highlight-list">
              ${renderHighlights(product)}
            </ul>
          </section>

          <section class="panel detail-panel">
            <h3><i class="fa-solid fa-shield-heart" aria-hidden="true"></i> Planning notes</h3>
            <div class="detail-meta-grid">
              <div class="detail-meta-item">
                <span>Category</span>
                <strong>${escapeHtml(category)}</strong>
              </div>
              <div class="detail-meta-item">
                <span>Stock level</span>
                <strong>${stock > 0 ? `${stock} ready now` : "On request"}</strong>
              </div>
              <div class="detail-meta-item">
                <span>Installation</span>
                <strong>Available on booking</strong>
              </div>
              <div class="detail-meta-item">
                <span>Product support</span>
                <strong>Pre-sale sizing help</strong>
              </div>
            </div>
            <p class="panel-copy">
              Need help matching this unit to your appliances or solar goals? Book advice before checkout and we’ll help size the right backup setup.
            </p>
          </section>
        </div>
      </article>
    </div>
  `;
}

async function init() {
  await bootstrapPage("products");

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const target = document.getElementById("product-detail");

  if (!productId) {
    target.innerHTML = `<div class="empty-state">Choose a product from the catalog first.</div>`;
    return;
  }

  try {
    const product = await getProduct(productId);
    updateHero(product);
    updateMetadata(product);
    target.innerHTML = renderDetail(product);

    document.getElementById("add-to-cart-button")?.addEventListener("click", () => {
      addToCart(product, 1);
      refreshShell();
      showToast(`${product.name} added to cart.`, "success");
    });
  } catch (error) {
    target.innerHTML = `<div class="empty-state">${error.message}</div>`;
    showToast(error.message, "error");
  }
}

init();
