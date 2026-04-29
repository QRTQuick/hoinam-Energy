import { bootstrapPage } from "../app-shell.js";
import { listProducts } from "../api.js";
import { addToCart } from "../store.js";
import { formatProductPrice, productMedia, showToast } from "../ui.js";

let allProducts = [];
let allStores = [];
let currentStore = null;
let currentSort = "featured";
let currentSearch = "";

async function init() {
  try {
    await bootstrapPage("shop");
    await loadProducts();
    setupEventListeners();
  } catch (error) {
    console.error("Error initializing shop:", error);
    showToast("Failed to load shop data", "error");
  }
}

async function loadProducts(storeSlug = null) {
  try {
    const grid = document.getElementById("products-grid");
    if (grid) {
      grid.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
    }

    allProducts = await listProducts();

    if (storeSlug) {
      allProducts = allProducts.filter((p) => p.store_slug === storeSlug || p.brand === storeSlug);
    }

    renderProducts(allProducts);
  } catch (error) {
    console.error("Error loading products:", error);
    showToast("Failed to load products", "error");
    const grid = document.getElementById("products-grid");
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle"></i>
          <p>Failed to load products. Please try again.</p>
        </div>
      `;
    }
  }
}

function renderProducts(products) {
  const grid = document.getElementById("products-grid");
  if (!grid) return;

  if (!products || products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>No products found in this store.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products
    .map(
      (product) => `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-image">
        ${productMedia(product)}
        ${product.featured ? '<span class="product-badge">Featured</span>' : ""}
      </div>
      <div class="product-info">
        <div class="product-brand">${product.brand || "Hoinam"}</div>
        <h3 class="product-name">${product.name}</h3>
        <div class="product-price">${formatProductPrice(product.price, product.currency)}</div>
        <div class="product-stock ${product.stock === 0 ? "out" : product.stock < 5 ? "low" : ""}">
          ${
            product.stock === 0
              ? '<i class="fas fa-times-circle"></i> Out of Stock'
              : product.stock < 5
              ? `<i class="fas fa-exclamation-circle"></i> Only ${product.stock} left`
              : `<i class="fas fa-check-circle"></i> In Stock (${product.stock})`
          }
        </div>
        <button class="add-to-cart-btn" ${product.stock === 0 ? "disabled" : ""}>
          <i class="fas fa-shopping-cart"></i> Add to Cart
        </button>
      </div>
    </div>
  `
    )
    .join("");

  grid.querySelectorAll(".product-card").forEach((card) => {
    const addBtn = card.querySelector(".add-to-cart-btn");
    addBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const productId = parseInt(card.dataset.productId);
      const product = products.find((p) => p.id === productId);
      if (product) {
        addToCart(product, 1);
        showToast(`${product.name} added to cart!`, "success");
      }
    });

    card.addEventListener("click", () => {
      window.location.href = `/product-detail.html?id=${card.dataset.productId}`;
    });
  });
}

function applyFilters() {
  let filtered = [...allProducts];

  if (currentSearch) {
    const query = currentSearch.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query)) ||
        (p.summary && p.summary.toLowerCase().includes(query))
    );
  }

  filtered.sort((a, b) => {
    switch (currentSort) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "featured":
      default:
        if (a.featured !== b.featured) {
          return b.featured ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
    }
  });

  renderProducts(filtered);
}

function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  searchInput?.addEventListener("input", (e) => {
    currentSearch = e.target.value;
    applyFilters();
  });

  const sortSelect = document.getElementById("sort-select");
  sortSelect?.addEventListener("change", (e) => {
    currentSort = e.target.value;
    applyFilters();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
