import { listProducts } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { refreshInteractions } from "../interactions.js";
import { renderProductCard, showToast } from "../ui.js";

async function init() {
  await bootstrapPage("home");

  const productGrid = document.getElementById("featured-products");
  const productCount = document.querySelector("[data-product-count]");
  const stockCount = document.querySelector("[data-stock-count]");
  const categoryCount = document.querySelector("[data-category-count]");

  try {
    const products = await listProducts();
    const featured = products.filter((product) => product.featured).slice(0, 4);
    const categories = new Set(products.map((product) => product.category).filter(Boolean));
    const totalStock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);

    if (productCount) {
      productCount.dataset.countUp = String(products.length);
      productCount.textContent = String(products.length);
    }
    if (stockCount) {
      stockCount.dataset.countUp = String(totalStock);
      stockCount.textContent = String(totalStock);
    }
    if (categoryCount) {
      categoryCount.dataset.countUp = String(categories.size);
      categoryCount.textContent = String(categories.size);
    }

    productGrid.innerHTML = featured.map(renderProductCard).join("");
    refreshInteractions(productGrid);
    refreshInteractions(document.querySelector(".hero-stats") || document);
  } catch (error) {
    productGrid.innerHTML = `<div class="empty-state">${error.message}</div>`;
    showToast(error.message, "error");
  }
}

init();
