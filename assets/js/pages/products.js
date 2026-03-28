import { listProducts } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { refreshInteractions } from "../interactions.js";
import { formatMoney, productMedia, showToast } from "../ui.js";

let allProducts = [];

const sidebarMedia = window.matchMedia("(max-width: 980px)");

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
    searchForm: document.getElementById("catalog-search-form"),
    searchInput: document.getElementById("search-products"),
    clearSearch: document.getElementById("clear-search"),
    categoryFilter: document.getElementById("category-filter"),
    sortSelect: document.getElementById("sort-products"),
    inStockOnly: document.getElementById("in-stock-only"),
    featuredOnly: document.getElementById("featured-only"),
    clearFilters: document.getElementById("clear-filters"),
    toolbarReset: document.getElementById("toolbar-reset"),
    resultsCount: document.getElementById("results-count"),
    resultsSummary: document.getElementById("results-summary"),
    productsGrid: document.getElementById("products-grid"),
    suggestions: document.getElementById("search-suggestions"),
    activeFilters: document.getElementById("active-filters"),
    categoryChips: document.getElementById("category-chips"),
    totalProducts: document.getElementById("catalog-total-products"),
    totalCategories: document.getElementById("catalog-total-categories"),
    totalStock: document.getElementById("catalog-total-stock"),
    sidebar: document.getElementById("catalog-sidebar"),
    sidebarBackdrop: document.getElementById("catalog-sidebar-backdrop"),
    openFilters: document.getElementById("open-filters"),
    toolbarFilters: document.getElementById("toolbar-filters"),
    closeFilters: document.getElementById("close-filters")
  };
}

function getState() {
  const controls = getControls();
  return {
    search: controls.searchInput.value.trim(),
    category: controls.categoryFilter.value,
    sort: controls.sortSelect.value,
    inStockOnly: Boolean(controls.inStockOnly.checked),
    featuredOnly: Boolean(controls.featuredOnly.checked)
  };
}

function hasActiveFilters(state = getState()) {
  return Boolean(
    state.search ||
    state.category ||
    state.sort !== "relevance" ||
    state.inStockOnly ||
    state.featuredOnly
  );
}

function syncUrl() {
  const { search, category, sort, inStockOnly, featuredOnly } = getState();
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

  if (inStockOnly) {
    params.set("stock", "1");
  } else {
    params.delete("stock");
  }

  if (featuredOnly) {
    params.set("featured", "1");
  } else {
    params.delete("featured");
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
  controls.inStockOnly.checked = params.get("stock") === "1";
  controls.featuredOnly.checked = params.get("featured") === "1";
}

function setActiveCategoryChip(category) {
  document.querySelectorAll("[data-category-chip]").forEach((chip) => {
    const active = chip.dataset.categoryChip === category;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateSearchClearVisibility() {
  const { searchInput, clearSearch } = getControls();
  const hasSearch = Boolean(searchInput.value.trim());
  clearSearch.classList.toggle("hidden", !hasSearch);
  clearSearch.disabled = !hasSearch;
}

function updateHeroStats(products = allProducts) {
  const controls = getControls();
  const categories = new Set(products.map((product) => product.category).filter(Boolean));
  const stock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);

  controls.totalProducts.textContent = String(products.length);
  controls.totalCategories.textContent = String(categories.size);
  controls.totalStock.textContent = String(stock);
}

function renderSuggestionList() {
  const { searchInput, suggestions } = getControls();
  const query = searchInput.value.trim();
  updateSearchClearVisibility();

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
  const availability = stock > 0 ? "In stock now" : "Available on request";
  const highlights = (product.highlights || []).slice(0, 3);
  const highlightMarkup = highlights.length
    ? `
      <div class="catalog-result-highlights">
        ${highlights
          .map((item) => `<span class="catalog-result-highlight">${highlightMatch(item, query)}</span>`)
          .join("")}
      </div>
    `
    : "";

  return `
    <article class="catalog-result-card interactive-card">
      <div class="catalog-result-media">
        ${productMedia(product, "product-media catalog-result-image")}
      </div>
      <div class="catalog-result-body">
        <div class="catalog-result-meta">
          <span class="catalog-result-tag">${escapeHtml(product.category || "EcoFlow")}</span>
          ${product.featured ? '<span class="catalog-result-tag is-featured">Featured pick</span>' : ""}
          <span class="catalog-result-stock ${stock > 0 ? "is-in-stock" : "is-backorder"}">${availability}: ${stock}</span>
        </div>
        <h2><a href="/product-detail.html?id=${product.id}">${highlightMatch(product.name, query)}</a></h2>
        <p class="catalog-result-summary">${highlightMatch(product.summary || "Reliable solar and backup power from Hoinam Energy.", query)}</p>
        ${highlightMarkup}
        <div class="catalog-result-details">
          <span><strong>Type:</strong> ${escapeHtml(product.category || "Portable Power")}</span>
          <span><strong>Best for:</strong> ${escapeHtml(highlights[0] || "Homes, shops, and backup setups")}</span>
        </div>
      </div>
      <div class="catalog-result-actions">
        <div class="catalog-result-price-block">
          <span class="catalog-result-price-label">Listed price</span>
          <strong class="catalog-result-price">${formatMoney(product.price, product.currency)}</strong>
        </div>
        <div class="catalog-result-button-stack">
          <a class="button" href="/product-detail.html?id=${product.id}"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> View details</a>
          <a class="button button-ghost" href="/book-install.html?productId=${product.id}"><i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i> Get advice</a>
        </div>
      </div>
    </article>
  `;
}

function buildSummary(state, count) {
  const labels = [];

  if (state.search) {
    labels.push(`"${state.search}"`);
  }
  if (state.category) {
    labels.push(state.category);
  }
  if (state.inStockOnly) {
    labels.push("in-stock only");
  }
  if (state.featuredOnly) {
    labels.push("featured picks");
  }

  if (!labels.length) {
    return "Showing the full Hoinam catalog with ranked search, live stock, and direct paths to product detail and advice.";
  }

  const joined = labels.join(", ");
  return `Showing ${count} matching result${count === 1 ? "" : "s"} for ${joined}.`;
}

function renderActiveFilters() {
  const controls = getControls();
  const state = getState();
  const sortLabels = {
    featured: "Featured first",
    "price-asc": "Price low to high",
    "price-desc": "Price high to low",
    "name-asc": "Name A to Z",
    "stock-desc": "Stock high to low"
  };

  const items = [];
  if (state.search) {
    items.push({ key: "search", label: `Search: ${state.search}` });
  }
  if (state.category) {
    items.push({ key: "category", label: state.category });
  }
  if (state.inStockOnly) {
    items.push({ key: "stock", label: "In stock only" });
  }
  if (state.featuredOnly) {
    items.push({ key: "featured", label: "Featured only" });
  }
  if (state.sort !== "relevance" && sortLabels[state.sort]) {
    items.push({ key: "sort", label: sortLabels[state.sort] });
  }

  if (!items.length) {
    controls.activeFilters.innerHTML = "";
    controls.activeFilters.classList.add("hidden");
    return;
  }

  controls.activeFilters.innerHTML = `
    <span class="catalog-active-label">Active filters</span>
    ${items
      .map(
        (item) => `
          <button class="catalog-active-pill" type="button" data-remove-filter="${item.key}">
            <span>${escapeHtml(item.label)}</span>
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        `
      )
      .join("")}
  `;
  controls.activeFilters.classList.remove("hidden");
}

function updateResetButtons() {
  const controls = getControls();
  const hasFilters = hasActiveFilters();
  controls.clearFilters.disabled = !hasFilters;
  controls.toolbarReset.disabled = !hasFilters;
}

function renderProducts() {
  const controls = getControls();
  const state = getState();

  const filtered = allProducts
    .map((product) => ({ product, score: scoreProduct(product, state.search) }))
    .filter(({ product, score }) => {
      const categoryMatch = !state.category || product.category === state.category;
      const inStockMatch = !state.inStockOnly || Number(product.stock || 0) > 0;
      const featuredMatch = !state.featuredOnly || Boolean(product.featured);
      const searchMatch = state.search ? score > 0 : true;
      return categoryMatch && inStockMatch && featuredMatch && searchMatch;
    });

  const sorted = [...filtered];
  if (state.sort === "price-asc") {
    sorted.sort((a, b) => Number(a.product.price || 0) - Number(b.product.price || 0));
  } else if (state.sort === "price-desc") {
    sorted.sort((a, b) => Number(b.product.price || 0) - Number(a.product.price || 0));
  } else if (state.sort === "name-asc") {
    sorted.sort((a, b) => (a.product.name || "").localeCompare(b.product.name || ""));
  } else if (state.sort === "stock-desc") {
    sorted.sort((a, b) => Number(b.product.stock || 0) - Number(a.product.stock || 0));
  } else if (state.sort === "featured") {
    sorted.sort((a, b) => Number(Boolean(b.product.featured)) - Number(Boolean(a.product.featured)));
  } else {
    sorted.sort((a, b) => b.score - a.score || (a.product.name || "").localeCompare(b.product.name || ""));
  }

  controls.resultsCount.textContent = `${sorted.length} result${sorted.length === 1 ? "" : "s"}`;
  controls.resultsSummary.textContent = buildSummary(state, sorted.length);
  renderActiveFilters();
  updateSearchClearVisibility();
  updateResetButtons();

  if (!sorted.length) {
    controls.productsGrid.innerHTML = `
      <div class="empty-state catalog-empty-state">
        <h3>No products matched this search.</h3>
        <p>Try a broader keyword like River, Delta, solar, or backup, or clear the filters and start again.</p>
        <div class="catalog-empty-actions">
          <button class="button" type="button" data-reset-catalog>Clear filters</button>
          <a class="button button-ghost" href="/contact.html"><i class="fa-solid fa-headset" aria-hidden="true"></i> Talk to Hoinam</a>
        </div>
      </div>
    `;
    refreshInteractions(controls.productsGrid);
    syncUrl();
    return;
  }

  controls.productsGrid.innerHTML = sorted
    .map(({ product }) => renderProductResult(product, state.search))
    .join("");

  refreshInteractions(controls.productsGrid);
  syncUrl();
}

function clearAllFilters() {
  const controls = getControls();
  controls.searchInput.value = "";
  controls.categoryFilter.value = "";
  controls.sortSelect.value = "relevance";
  controls.inStockOnly.checked = false;
  controls.featuredOnly.checked = false;
  controls.suggestions.classList.add("hidden");
  setActiveCategoryChip("");
  updateSearchClearVisibility();
}

function clearFilterByKey(key) {
  const controls = getControls();
  if (key === "search") {
    controls.searchInput.value = "";
    controls.suggestions.classList.add("hidden");
  } else if (key === "category") {
    controls.categoryFilter.value = "";
    setActiveCategoryChip("");
  } else if (key === "sort") {
    controls.sortSelect.value = "relevance";
  } else if (key === "stock") {
    controls.inStockOnly.checked = false;
  } else if (key === "featured") {
    controls.featuredOnly.checked = false;
  }

  renderSuggestionList();
  renderProducts();
}

function scrollResultsIntoView() {
  document.querySelector(".catalog-main")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function openFilters() {
  const controls = getControls();
  if (!sidebarMedia.matches) {
    controls.sidebar?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    return;
  }

  document.body.classList.add("catalog-filters-open");
  controls.sidebarBackdrop.classList.remove("hidden");
}

function closeFilters() {
  const controls = getControls();
  document.body.classList.remove("catalog-filters-open");
  controls.sidebarBackdrop.classList.add("hidden");
}

function syncSidebarMode() {
  if (!sidebarMedia.matches) {
    closeFilters();
  }
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
    scrollResultsIntoView();
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
    updateHeroStats(allProducts);

    const categories = [...new Set(allProducts.map((product) => product.category).filter(Boolean))];
    controls.categoryFilter.innerHTML += categories
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("");

    controls.categoryChips.innerHTML = [
      `<button class="chip chip-button is-active" type="button" data-category-chip="">All products</button>`,
      ...categories.map(
        (category) => `<button class="chip chip-button" type="button" data-category-chip="${escapeHtml(category)}">${escapeHtml(category)}</button>`
      )
    ].join("");

    controls.categoryChips.querySelectorAll("[data-category-chip]").forEach((chip) => {
      chip.addEventListener("click", () => {
        controls.categoryFilter.value = chip.dataset.categoryChip || "";
        setActiveCategoryChip(chip.dataset.categoryChip || "");
        renderProducts();
        if (sidebarMedia.matches) {
          scrollResultsIntoView();
        }
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

  controls.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    controls.suggestions.classList.add("hidden");
    renderProducts();
    scrollResultsIntoView();
  });

  controls.searchInput.addEventListener("input", () => {
    renderSuggestionList();
    renderProducts();
  });

  controls.searchInput.addEventListener("focus", renderSuggestionList);

  controls.clearSearch.addEventListener("click", () => {
    controls.searchInput.value = "";
    controls.searchInput.focus();
    controls.suggestions.classList.add("hidden");
    renderSuggestionList();
    renderProducts();
  });

  controls.categoryFilter.addEventListener("change", (event) => {
    setActiveCategoryChip(event.target.value || "");
    renderProducts();
  });

  controls.sortSelect.addEventListener("change", renderProducts);
  controls.inStockOnly.addEventListener("change", renderProducts);
  controls.featuredOnly.addEventListener("change", renderProducts);

  document.querySelectorAll("[data-search-shortcut]").forEach((button) => {
    button.addEventListener("click", () => {
      controls.searchInput.value = button.dataset.searchShortcut || "";
      renderSuggestionList();
      renderProducts();
      scrollResultsIntoView();
    });
  });

  [controls.clearFilters, controls.toolbarReset].forEach((button) => {
    button.addEventListener("click", () => {
      clearAllFilters();
      renderSuggestionList();
      renderProducts();
    });
  });

  [controls.openFilters, controls.toolbarFilters].forEach((button) => {
    button?.addEventListener("click", openFilters);
  });

  controls.closeFilters?.addEventListener("click", closeFilters);
  controls.sidebarBackdrop?.addEventListener("click", closeFilters);

  controls.activeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-filter]");
    if (!button) {
      return;
    }

    clearFilterByKey(button.dataset.removeFilter || "");
  });

  controls.productsGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reset-catalog]");
    if (!button) {
      return;
    }

    clearAllFilters();
    renderSuggestionList();
    renderProducts();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebarMedia.matches) {
      closeFilters();
    }
  });

  if (typeof sidebarMedia.addEventListener === "function") {
    sidebarMedia.addEventListener("change", syncSidebarMode);
  } else if (typeof sidebarMedia.addListener === "function") {
    sidebarMedia.addListener(syncSidebarMode);
  }

  bindSuggestionEvents();
  syncSidebarMode();
}

init();
