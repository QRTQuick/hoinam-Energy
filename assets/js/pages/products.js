import { listProducts } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { refreshInteractions } from "../interactions.js";
import { renderProductCard, showToast } from "../ui.js";

let allProducts = [];

function renderProducts() {
  const target = document.getElementById("products-grid");
  const search = document.getElementById("search-products").value.trim().toLowerCase();
  const category = document.getElementById("category-filter").value;
  const sort = document.getElementById("sort-products").value;

  const filtered = allProducts.filter((product) => {
    const haystack = `${product.name} ${product.summary || ""} ${product.category || ""}`.toLowerCase();
    const categoryMatch = !category || product.category === category;
    return categoryMatch && haystack.includes(search);
  });

  const sorted = [...filtered];
  if (sort === "price-asc") {
    sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (sort === "price-desc") {
    sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (sort === "name-asc") {
    sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (sort === "stock-desc") {
    sorted.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
  }

  const resultsCount = document.getElementById("results-count");
  if (resultsCount) {
    resultsCount.textContent = `${sorted.length} product${sorted.length === 1 ? "" : "s"}`;
  }

  if (!filtered.length) {
    target.innerHTML = `<div class="empty-state">No products match your search yet.</div>`;
    refreshInteractions(target);
    return;
  }

  target.innerHTML = sorted.map(renderProductCard).join("");
  refreshInteractions(target);
}

function setActiveCategoryChip(category) {
  document.querySelectorAll("[data-category-chip]").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.categoryChip === category);
    chip.setAttribute("aria-pressed", chip.dataset.categoryChip === category ? "true" : "false");
  });
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

    const chipRow = document.getElementById("category-chips");
    if (chipRow) {
      chipRow.innerHTML = [
        `<button class="chip chip-button is-active" type="button" data-category-chip="">All</button>`,
        ...categories.map(
          (category) => `<button class="chip chip-button" type="button" data-category-chip="${category}">${category}</button>`
        )
      ].join("");

      chipRow.querySelectorAll("[data-category-chip]").forEach((chip) => {
        chip.addEventListener("click", () => {
          categoryFilter.value = chip.dataset.categoryChip || "";
          setActiveCategoryChip(chip.dataset.categoryChip || "");
          renderProducts();
        });
      });
    }

    renderProducts();
  } catch (error) {
    document.getElementById("products-grid").innerHTML = `<div class="empty-state">${error.message}</div>`;
    showToast(error.message, "error");
  }

  document.getElementById("search-products").addEventListener("input", renderProducts);
  document.getElementById("category-filter").addEventListener("change", (event) => {
    setActiveCategoryChip(event.target.value || "");
    renderProducts();
  });
  document.getElementById("sort-products").addEventListener("change", renderProducts);
  document.getElementById("clear-filters").addEventListener("click", () => {
    document.getElementById("search-products").value = "";
    document.getElementById("category-filter").value = "";
    document.getElementById("sort-products").value = "featured";
    setActiveCategoryChip("");
    renderProducts();
  });
}

init();
