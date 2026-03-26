import { listProducts } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
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
      productCount.textContent = String(products.length);
    }
    if (stockCount) {
      stockCount.textContent = String(totalStock);
    }
    if (categoryCount) {
      categoryCount.textContent = String(categories.size);
    }

    productGrid.innerHTML = featured.map(renderProductCard).join("");
  } catch (error) {
    productGrid.innerHTML = `<div class="empty-state">${error.message}</div>`;
    showToast(error.message, "error");
  }
}

init();
