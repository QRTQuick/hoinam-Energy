import { getProduct } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { addToCart } from "../store.js";
import { formatMoney, productMedia, refreshShell, showToast } from "../ui.js";

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
    target.innerHTML = `
      <div class="detail-layout">
        <article class="panel detail-card">
          ${productMedia(product)}
        </article>
        <article class="detail-copy">
          <span class="eyebrow">${product.category || "EcoFlow product"}</span>
          <h1>${product.name}</h1>
          <p>${product.description || product.summary || "Clean energy backup engineered for modern homes and businesses."}</p>
          <div class="chip-row">
            <span class="stock-pill">${product.stock} in stock</span>
            <span class="badge">${formatMoney(product.price, product.currency)}</span>
          </div>
          <div class="panel">
            <h3>Highlights</h3>
            <ul class="list-reset">
              ${(product.highlights || ["Solar-ready", "Installation support", "Business continuity"]).map((item) => `<li>${item}</li>`).join("")}
            </ul>
          </div>
          <div class="inline-actions">
            <button class="button" id="add-to-cart-button" type="button">Add to cart</button>
            <a class="button button-secondary" href="/book-install.html?productId=${product.id}">Book installation</a>
          </div>
        </article>
      </div>
    `;

    document.getElementById("add-to-cart-button").addEventListener("click", () => {
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
