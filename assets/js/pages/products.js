import { listProducts } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { refreshInteractions } from "../interactions.js";
import { formatMoney, productMedia, showToast } from "../ui.js";

let allProducts = [];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function highlightMatch(value = "", query = "") {
  const safeValue = escapeHtml(value);
  const term = query.trim();
  if (!term) {
    return safeValue;
  }

  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safeValue.replace(new RegExp(`(${escapedTerm})`, "ig"), "<mark>$1</mark>");
}

function buildSearchTerms(product) {
  return [
    product.name,
    product.summary,
    product.description,
    product.category,
    ...(product.highlights || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreProduct(product, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return product.featured ? 40 : 10;
  }

  const name = (product.name || "").toLowerCase();
  const category = (product.category || "").toLowerCase();
  const summary = (product.summary || "").toLowerCase();
  const haystack = buildSearchTerms(product);
  const terms = normalized.split(/\s+/).filter(Boolean);

  let score = 0;
  for (const term of terms) {
    if (name === term) {
      score += 200;
    }
    if (name.startsWith(term)) {
      score += 120;
    }
    if (name.includes(term)) {
      score += 80;
    }
    if (category.includes(term)) {
      score += 35;
    }
    if (summary.includes(term)) {
      score += 20;
    }
    if (haystack.includes(term)) {
      score += 12;
    }
  }

  if (name.includes(normalized)) {
    score += 140;
  }
  if (haystack.includes(normalized)) {
    score += 50;
  }
  if (product.featured) {
    score += 8;
  }
  if (Number(product.stock || 0) > 0) {
    score += 4;
  }

  return score;
}

function getControls() {
  return {
    searchInput: document.getElementById("search-products"),
    categoryFilter: document.getElementById("category-filter"),
    sortSelect: document.getElementById("sort-products"),
    resultsCount: document.getElementById("results-count"),
    resultsSummary: document.getElementById("results-summary"),
    productsGrid: document.getElementById("products-grid"),
    suggestions: document.getElementById("search-suggestions")
  };
}

function getState() {
  const controls = getControls();
  return {
    search: controls.searchInput.value.trim(),
    category: controls.categoryFilter.value,
    sort: controls.sortSelect.value
  };
}

function syncUrl() {
  const { search, category, sort } = getState();
  const params = new URLSearchParams(window.location.search);

  if (search) {
    params.set("q", search);
  } else {
    params.delete("q");
  }

  if (category) {
    params.set("category", category);
  } else {
    params.delete("category");
  }

  if (sort && sort !== "relevance") {
    params.set("sort", sort);
  } else {
    params.delete("sort");
  }

  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  window.history.replaceState({}, "", next);
}

function loadStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const controls = getControls();
  controls.searchInput.value = params.get("q") || "";
  controls.categoryFilter.value = params.get("category") || "";
  controls.sortSelect.value = params.get("sort") || "relevance";
}

function setActiveCategoryChip(category) {
  document.querySelectorAll("[data-category-chip]").forEach((chip) => {
    const active = chip.dataset.categoryChip === category;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function renderSuggestionList() {
  const { searchInput, suggestions } = getControls();
  const query = searchInput.value.trim();

  if (!query) {
    suggestions.innerHTML = "";
    suggestions.classList.add("hidden");
    return;
  }

  const matches = allProducts
    .map((product) => ({ product, score: scoreProduct(product, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (!matches.length) {
    suggestions.innerHTML = "";
    suggestions.classList.add("hidden");
    return;
  }

  suggestions.innerHTML = matches
    .map(
      ({ product }) => `
        <button class="search-suggestion-item" type="button" data-suggestion="${escapeHtml(product.name)}">
          <span class="search-suggestion-title">${highlightMatch(product.name, query)}</span>
          <span class="search-suggestion-meta">${escapeHtml(product.category || "EcoFlow")} - ${formatMoney(product.price, product.currency)}</span>
        </button>
      `
    )
    .join("");

  suggestions.classList.remove("hidden");
}

function renderProductResult(product, query = "") {
  const stock = Number(product.stock || 0);
  const availability = stock > 0 ? "In stock" : "Available on request";

  return `
    <article class="catalog-result-card interactive-card">
      <div class="catalog-result-media">
        ${productMedia(product, "product-media catalog-result-image")}
      </div>
      <div class="catalog-result-body">
        <div class="catalog-result-meta">
          <span class="catalog-result-tag">${escapeHtml(product.category || "EcoFlow")}</span>
          <span class="catalog-result-stock ${stock > 0 ? "is-in-stock" : "is-backorder"}">${availability}: ${stock}</span>
        </div>
        <h2><a href="/product-detail.html?id=${product.id}">${highlightMatch(product.name, query)}</a></h2>
        <p class="catalog-result-summary">${highlightMatch(product.summary || "Reliable solar and backup power from Hoinam Energy.", query)}</p>
        <div class="catalog-result-details">
          <span><strong>Type:</strong> ${escapeHtml(product.category || "Portable Power")}</span>
          <span><strong>Best for:</strong> ${escapeHtml((product.highlights || []).slice(0, 1)[0] || "Homes, shops, and backup setups")}</span>
        </div>
      </div>
      <div class="catalog-result-actions">
        <strong class="catalog-result-price">${formatMoney(product.price, product.currency)}</strong>
        <a class="button" href="/product-detail.html?id=${product.id}"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> View item</a>
        <a class="button button-ghost" href="/book-install.html?productId=${product.id}"><i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i> Get advice</a>
      </div>
    </article>
  `;
}

function renderProducts() {
  const controls = getControls();
  const { search, category, sort } = getState();

  const filtered = allProducts
    .map((product) => ({ product, score: scoreProduct(product, search) }))
    .filter(({ product, score }) => {
      const categoryMatch = !category || product.category === category;
      return categoryMatch && (search ? score > 0 : true);
    });

  const sorted = [...filtered];
  if (sort === "price-asc") {
    sorted.sort((a, b) => Number(a.product.price || 0) - Number(b.product.price || 0));
  } else if (sort === "price-desc") {
    sorted.sort((a, b) => Number(b.product.price || 0) - Number(a.product.price || 0));
  } else if (sort === "name-asc") {
    sorted.sort((a, b) => (a.product.name || "").localeCompare(b.product.name || ""));
  } else if (sort === "stock-desc") {
    sorted.sort((a, b) => Number(b.product.stock || 0) - Number(a.product.stock || 0));
  } else if (sort === "featured") {
    sorted.sort((a, b) => Number(Boolean(b.product.featured)) - Number(Boolean(a.product.featured)));
  } else {
    sorted.sort((a, b) => b.score - a.score || (a.product.name || "").localeCompare(b.product.name || ""));
  }

  controls.resultsCount.textContent = `${sorted.length} result${sorted.length === 1 ? "" : "s"}`;
  if (search && category) {
    controls.resultsSummary.textContent = `Showing ranked matches for "${search}" in ${category}.`;
  } else if (search) {
    controls.resultsSummary.textContent = `Showing ranked matches for "${search}" across the full EcoFlow catalog.`;
  } else if (category) {
    controls.resultsSummary.textContent = `Showing all ${category} products in inventory.`;
  } else {
    controls.resultsSummary.textContent = "Showing the full inventory with search-first ranking and quick product access.";
  }

  if (!sorted.length) {
    controls.productsGrid.innerHTML = `
      <div class="empty-state catalog-empty-state">
        <h3>No products matched this search.</h3>
        <p>Try a broader keyword like River, Delta, solar, or backup.</p>
      </div>
    `;
    refreshInteractions(controls.productsGrid);
    syncUrl();
    return;
  }

  controls.productsGrid.innerHTML = sorted
    .map(({ product }) => renderProductResult(product, search))
    .join("");

  refreshInteractions(controls.productsGrid);
  syncUrl();
}

function bindSuggestionEvents() {
  const { suggestions, searchInput } = getControls();

  suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggestion]");
    if (!button) {
      return;
    }

    searchInput.value = button.dataset.suggestion || "";
    suggestions.classList.add("hidden");
    renderProducts();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".catalog-search-form")) {
      return;
    }
    suggestions.classList.add("hidden");
  });
}

async function init() {
  await bootstrapPage("products");

  const controls = getControls();

  try {
    allProducts = await listProducts();
    const categories = [...new Set(allProducts.map((product) => product.category).filter(Boolean))];

    controls.categoryFilter.innerHTML += categories
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("");

    const chipRow = document.getElementById("category-chips");
    chipRow.innerHTML = [
      `<button class="chip chip-button is-active" type="button" data-category-chip="">All products</button>`,
      ...categories.map(
        (category) => `<button class="chip chip-button" type="button" data-category-chip="${escapeHtml(category)}">${escapeHtml(category)}</button>`
      )
    ].join("");

    chipRow.querySelectorAll("[data-category-chip]").forEach((chip) => {
      chip.addEventListener("click", () => {
        controls.categoryFilter.value = chip.dataset.categoryChip || "";
        setActiveCategoryChip(chip.dataset.categoryChip || "");
        renderProducts();
      });
    });

    loadStateFromUrl();
    setActiveCategoryChip(controls.categoryFilter.value || "");
    renderSuggestionList();
    renderProducts();
  } catch (error) {
    controls.productsGrid.innerHTML = `<div class="empty-state">${error.message}</div>`;
    showToast(error.message, "error");
    return;
  }

  document.getElementById("catalog-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    controls.suggestions.classList.add("hidden");
    renderProducts();
  });

  controls.searchInput.addEventListener("input", () => {
    renderSuggestionList();
    renderProducts();
  });

  controls.searchInput.addEventListener("focus", renderSuggestionList);

  controls.categoryFilter.addEventListener("change", (event) => {
    setActiveCategoryChip(event.target.value || "");
    renderProducts();
  });

  controls.sortSelect.addEventListener("change", renderProducts);

  document.querySelectorAll("[data-search-shortcut]").forEach((button) => {
    button.addEventListener("click", () => {
      controls.searchInput.value = button.dataset.searchShortcut || "";
      renderSuggestionList();
      renderProducts();
    });
  });

  document.getElementById("clear-filters").addEventListener("click", () => {
    controls.searchInput.value = "";
    controls.categoryFilter.value = "";
    controls.sortSelect.value = "relevance";
    controls.suggestions.classList.add("hidden");
    setActiveCategoryChip("");
    renderProducts();
  });

  bindSuggestionEvents();
}

init();
