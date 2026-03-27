import { listProducts } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { refreshInteractions } from "../interactions.js";
import { renderProductCard, showToast } from "../ui.js";

let allProducts = [];

function renderProducts() {
  const target = document.getElementById("products-grid");
  const search = document.getElementById("search-products").value.trim().toLowerCase();
  const category = document.getElementById("category-filter").value;

  const filtered = allProducts.filter((product) => {
    const haystack = `${product.name} ${product.summary || ""} ${product.category || ""}`.toLowerCase();
    const categoryMatch = !category || product.category === category;
    return categoryMatch && haystack.includes(search);
  });

  if (!filtered.length) {
    target.innerHTML = `<div class="empty-state">No products match your search yet.</div>`;
    refreshInteractions(target);
    return;
  }

  target.innerHTML = filtered.map(renderProductCard).join("");
  refreshInteractions(target);
}

async function init() {
  await bootstrapPage("products");

  try {
    allProducts = await listProducts();
    const categoryFilter = document.getElementById("category-filter");
    const categories = [...new Set(allProducts.map((product) => product.category).filter(Boolean))];
    categoryFilter.innerHTML += categories
      .map((category) => `<option value="${category}">${category}</option>`)
      .join("");
    renderProducts();
  } catch (error) {
    document.getElementById("products-grid").innerHTML = `<div class="empty-state">${error.message}</div>`;
    showToast(error.message, "error");
  }

  document.getElementById("search-products").addEventListener("input", renderProducts);
  document.getElementById("category-filter").addEventListener("change", renderProducts);
}

init();
