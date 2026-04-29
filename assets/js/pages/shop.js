import { bootstrapPage, redirectAfterAuth, redirectToLogin } from "../app-shell.js";
import { getCurrentToken, loginWithEmail } from "../firebase.js";
import { addToCart, getCart, updateCart } from "../store.js";
import { showToast } from "../ui.js";
import { getApiUrl, handleApiResponse } from "../api.js";

let allProducts = [];
let allStores = [];
let currentStore = null;
let currentSort = "featured";
let currentSearch = "";

async function init() {
  try {
    await bootstrapPage("shop");
    
    // Load stores and products
    await loadStores();
    await loadProducts();
    setupEventListeners();
  } catch (error) {
    console.error("Error initializing shop:", error);
    showToast("Failed to load shop data", "error");
  }
}

async function loadStores() {
  try {
    const response = await fetch(`${getApiUrl()}/stores`);
    const data = await handleApiResponse(response);
    allStores = data.data || [];
    renderStoreList();
  } catch (error) {
    console.error("Error loading stores:", error);
    showToast("Failed to load stores", "error");
  }
}

async function loadProducts(storeSlug = null) {
  try {
    const grid = document.getElementById("products-grid");
    grid.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
    `;

    const url = new URL(`${getApiUrl()}/products`);
    if (storeSlug) {
      url.searchParams.append("store", storeSlug);
    }

    const response = await fetch(url.toString());
    const data = await handleApiResponse(response);
    allProducts = data.data || [];
    
    renderProducts(allProducts);
  } catch (error) {
    console.error("Error loading products:", error);
    showToast("Failed to load products", "error");
    document.getElementById("products-grid").innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <p>Failed to load products. Please try again.</p>
      </div>
    `;
  }
}

function renderStoreList() {
  const container = document.getElementById("store-list");
  
  // Add "All Products" option
  const allStoresItem = document.createElement("div");
  allStoresItem.className = "store-item active";
  allStoresItem.innerHTML = `
    <div class="store-icon">
      <i class="fas fa-th" aria-hidden="true"></i>
    </div>
    <span>All Products</span>
  `;
  allStoresItem.addEventListener("click", () => selectStore(null, allStoresItem));
  container.appendChild(allStoresItem);

  // Add store items
  allStores.forEach((store) => {
    const item = document.createElement("div");
    item.className = "store-item";
    item.innerHTML = `
      <div class="store-icon">
        <i class="fas fa-store" aria-hidden="true"></i>
      </div>
      <span>${store.name}</span>
    `;
    item.addEventListener("click", () => selectStore(store.slug, item));
    container.appendChild(item);
  });
}

async function selectStore(storeSlug, element) {
  currentStore = storeSlug;
  
  // Update UI
  document.querySelectorAll(".store-item").forEach((item) => {
    item.classList.remove("active");
  });
  element.classList.add("active");

  // Update title
  if (storeSlug) {
    const store = allStores.find((s) => s.slug === storeSlug);
    document.getElementById("shop-title").textContent = store ? store.name : "All Products";
  } else {
    document.getElementById("shop-title").textContent = "All Products";
  }

  // Load products for store
  await loadProducts(storeSlug);
}

function renderProducts(products) {
  const grid = document.getElementById("products-grid");
  
  if (!products || products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>No products found in this store.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map((product) => `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-image">
        <img src="${product.image_url || '/assets/images/placeholder.png'}" alt="${product.name}" onerror="this.src='/assets/images/placeholder.png'">
        ${product.featured ? '<span class="product-badge">Featured</span>' : ""}
      </div>
      <div class="product-info">
        <div class="product-brand">${product.brand || "Hoinam"}</div>
        <h3 class="product-name">${product.name}</h3>
        <div class="product-price">${product.currency} ${product.price.toLocaleString()}</div>
        <div class="product-stock ${
          product.stock === 0 ? "out" : product.stock < 5 ? "low" : ""
        }">
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
  `).join("");

  // Attach event listeners to product cards
  grid.querySelectorAll(".product-card").forEach((card) => {
    const addBtn = card.querySelector(".add-to-cart-btn");
    addBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const productId = parseInt(card.dataset.productId);
      const product = products.find((p) => p.id === productId);
      
      try {
        addToCart(product, 1);
        showToast(`${product.name} added to cart!`, "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    // Navigate to product details
    card.addEventListener("click", () => {
      const productId = card.dataset.productId;
      window.location.href = `/product-detail.html?id=${productId}`;
    });
  });
}

function applyFilters() {
  let filtered = [...allProducts];

  // Apply search filter
  if (currentSearch) {
    const query = currentSearch.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.brand && p.brand.toLowerCase().includes(query)) ||
        (p.summary && p.summary.toLowerCase().includes(query))
    );
  }

  // Apply sorting
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
  // Search input
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value;
    applyFilters();
  });

  // Sort select
  const sortSelect = document.getElementById("sort-select");
  sortSelect.addEventListener("change", (e) => {
    currentSort = e.target.value;
    applyFilters();
  });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
