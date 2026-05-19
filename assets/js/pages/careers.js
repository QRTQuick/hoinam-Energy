import { listJobs } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { showToast } from "../ui.js";

const FILTERS = ["Full-Time", "Part-Time", "Remote", "Internship", "Marketing", "Tech", "Engineering"];
const PAGE_SIZE = 4;
const SAVED_KEY = "hoinam_saved_jobs";
const THEME_KEY = "hoinam_careers_theme";

let allJobs = [];
let filteredJobs = [];
let visibleCount = PAGE_SIZE;
let activeFilter = "";
let currentProfile = null;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSavedJobs() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"));
  } catch (_) {
    return new Set();
  }
}

function setSavedJobs(saved) {
  localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
}

function formatDeadline(value) {
  if (!value) return "Open";
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function jobSearchText(job) {
  return [
    job.title,
    job.company,
    job.location,
    job.job_type,
    job.salary,
    job.summary,
    job.about_company,
    ...(job.categories || []),
    ...(job.responsibilities || []),
    ...(job.requirements || []),
    ...(job.benefits || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getControls() {
  return {
    grid: document.getElementById("jobs-grid"),
    empty: document.getElementById("jobs-empty"),
    count: document.getElementById("jobs-count"),
    status: document.getElementById("pagination-status"),
    filters: document.getElementById("career-filters"),
    search: document.getElementById("job-search"),
    sort: document.getElementById("sort-jobs"),
    prev: document.getElementById("prev-page"),
    next: document.getElementById("next-page"),
    loadMore: document.getElementById("load-more-jobs"),
    modal: document.getElementById("job-modal"),
    modalHeading: document.getElementById("job-modal-heading"),
    modalContent: document.getElementById("job-modal-content"),
    modalClose: document.getElementById("job-modal-close"),
    themeToggle: document.getElementById("theme-toggle"),
    postJob: document.getElementById("post-job-button")
  };
}

function renderSkeletons() {
  const { grid } = getControls();
  grid.innerHTML = Array.from({ length: 4 })
    .map(
      () => `
        <article class="career-glass rounded-[1.75rem] p-5 career-skeleton">
          <div class="h-14 w-14 rounded-2xl bg-slate-200/80 dark:bg-slate-800"></div>
          <div class="mt-5 h-5 w-2/3 rounded-full bg-slate-200/80 dark:bg-slate-800"></div>
          <div class="mt-3 h-4 w-1/2 rounded-full bg-slate-200/80 dark:bg-slate-800"></div>
          <div class="mt-6 grid grid-cols-3 gap-3">
            <div class="h-10 rounded-full bg-slate-200/80 dark:bg-slate-800"></div>
            <div class="h-10 rounded-full bg-slate-200/80 dark:bg-slate-800"></div>
            <div class="h-10 rounded-full bg-slate-200/80 dark:bg-slate-800"></div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderFilters() {
  const { filters } = getControls();
  filters.innerHTML = [
    `<button class="career-filter ${!activeFilter ? "is-active" : ""} rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200" type="button" data-filter="">All</button>`,
    ...FILTERS.map(
      (filter) => `
        <button class="career-filter ${activeFilter === filter ? "is-active" : ""} rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200" type="button" data-filter="${escapeHtml(filter)}">
          ${escapeHtml(filter)}
        </button>
      `
    )
  ].join("");
}

function renderJobCard(job, index) {
  const saved = getSavedJobs();
  const isSaved = saved.has(String(job.id));
  const categories = (job.categories || []).slice(0, 3);
  const mailto = job.application_email
    ? `mailto:${encodeURIComponent(job.application_email)}?subject=${encodeURIComponent(job.email_subject || job.title)}`
    : "#";

  return `
    <article class="career-card career-glass careers-fade-in rounded-[1.75rem] p-5" style="animation-delay:${Math.min(index * 60, 240)}ms">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-4">
          <img class="h-14 w-14 rounded-2xl bg-white p-2 shadow-lg" src="${escapeHtml(job.logo_url || "/assets/images/hoinam-logo.png")}" alt="${escapeHtml(job.company)} logo" loading="lazy">
          <div>
            <div class="flex flex-wrap gap-2">
              ${job.featured ? '<span class="career-chip rounded-full bg-careerGold px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-950">Featured</span>' : ""}
              ${job.immediate_start ? '<span class="career-chip rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">Immediate</span>' : ""}
            </div>
            <h3 class="mt-3 text-xl font-black text-slate-950 dark:text-white">${escapeHtml(job.title)}</h3>
            <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">${escapeHtml(job.company)}</p>
          </div>
        </div>
        <button class="career-icon-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:border-careerGold hover:bg-careerGold hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" type="button" data-save-job="${job.id}" aria-label="Save job">
          <i class="${isSaved ? "fa-solid" : "fa-regular"} fa-bookmark" aria-hidden="true"></i>
        </button>
      </div>

      <p class="mt-4 line-clamp-2 text-sm leading-7 text-slate-600 dark:text-slate-300">${escapeHtml(job.summary || job.about_company || "")}</p>

      <div class="mt-5 flex flex-wrap gap-2">
        <span class="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(job.location)}</span>
        <span class="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">${escapeHtml(job.salary || "Competitive")}</span>
        <span class="rounded-full bg-blue-100 px-3 py-2 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">${escapeHtml(job.job_type)}</span>
        <span class="rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">Deadline: ${formatDeadline(job.deadline)}</span>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        ${categories.map((item) => `<span class="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 dark:border-slate-700 dark:text-slate-300">${escapeHtml(item)}</span>`).join("")}
      </div>

      <div class="mt-6 flex flex-col gap-3 sm:flex-row">
        <button class="career-btn inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-premium hover:bg-blue-700 dark:bg-white dark:text-slate-950 dark:hover:bg-careerGold" type="button" data-view-job="${job.id}">
          View Details
        </button>
        <a class="career-btn inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 px-5 py-3 text-sm font-bold text-slate-900 shadow-sm hover:border-careerGold hover:bg-careerGold dark:border-slate-700 dark:bg-slate-900 dark:text-white" href="${mailto}">
          Apply
        </a>
      </div>
    </article>
  `;
}

function applyFilters() {
  const { search, sort } = getControls();
  const query = search.value.trim().toLowerCase();

  filteredJobs = allJobs.filter((job) => {
    const categoryMatch = !activeFilter || (job.categories || []).includes(activeFilter);
    const queryMatch = !query || jobSearchText(job).includes(query);
    return categoryMatch && queryMatch;
  });

  const sorted = [...filteredJobs];
  if (sort.value === "deadline") {
    sorted.sort((a, b) => String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")));
  } else if (sort.value === "newest") {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (sort.value === "company") {
    sorted.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
  } else {
    sorted.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || new Date(b.created_at) - new Date(a.created_at));
  }

  filteredJobs = sorted;
  visibleCount = Math.min(Math.max(visibleCount, PAGE_SIZE), Math.max(filteredJobs.length, PAGE_SIZE));
  renderJobs();
}

function renderJobs() {
  const { grid, empty, count, status, prev, next, loadMore } = getControls();
  const visible = filteredJobs.slice(0, visibleCount);

  count.textContent = `${filteredJobs.length} job${filteredJobs.length === 1 ? "" : "s"} found`;
  status.textContent = filteredJobs.length
    ? `Showing ${visible.length} of ${filteredJobs.length}`
    : "No matching jobs";

  empty.classList.toggle("hidden", Boolean(filteredJobs.length));
  grid.innerHTML = visible.map(renderJobCard).join("");

  prev.disabled = true;
  next.disabled = visibleCount >= filteredJobs.length;
  loadMore.disabled = visibleCount >= filteredJobs.length;
}

function renderModalList(title, items = []) {
  if (!items.length) return "";
  return `
    <section class="mt-6">
      <h3 class="text-base font-black text-slate-950 dark:text-white">${escapeHtml(title)}</h3>
      <ul class="mt-3 space-y-3">
        ${items.map((item) => `
          <li class="flex gap-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            <i class="fa-solid fa-circle-check mt-1 text-blue-600 dark:text-careerGold" aria-hidden="true"></i>
            <span>${escapeHtml(item)}</span>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}

function openJobModal(jobId) {
  const job = allJobs.find((item) => item.id === Number(jobId));
  if (!job) return;

  const { modal, modalHeading, modalContent } = getControls();
  const mailto = job.application_email
    ? `mailto:${encodeURIComponent(job.application_email)}?subject=${encodeURIComponent(job.email_subject || job.title)}`
    : "#";

  modalHeading.innerHTML = `
    <div class="flex items-start gap-4">
      <img class="h-14 w-14 rounded-2xl bg-white p-2 shadow-lg" src="${escapeHtml(job.logo_url || "/assets/images/hoinam-logo.png")}" alt="${escapeHtml(job.company)} logo">
      <div>
        <span class="text-xs font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-200">${escapeHtml(job.company)}</span>
        <h2 class="mt-2 text-2xl font-black text-slate-950 dark:text-white" id="job-modal-title">${escapeHtml(job.title)}</h2>
        <p class="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">${escapeHtml(job.location)} - ${escapeHtml(job.job_type)}</p>
      </div>
    </div>
  `;

  modalContent.innerHTML = `
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/70">
        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Salary</span>
        <strong class="mt-1 block text-sm text-slate-950 dark:text-white">${escapeHtml(job.salary || "Competitive")}</strong>
      </div>
      <div class="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/70">
        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Deadline</span>
        <strong class="mt-1 block text-sm text-slate-950 dark:text-white">${formatDeadline(job.deadline)}</strong>
      </div>
      <div class="rounded-2xl bg-white/70 p-4 dark:bg-slate-900/70">
        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Email subject</span>
        <strong class="mt-1 block text-sm text-slate-950 dark:text-white">${escapeHtml(job.email_subject || "-")}</strong>
      </div>
    </div>

    <section class="mt-6">
      <h3 class="text-base font-black text-slate-950 dark:text-white">About Us</h3>
      <p class="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">${escapeHtml(job.about_company || job.summary || "")}</p>
    </section>

    ${renderModalList("Key Responsibilities", job.responsibilities)}
    ${renderModalList("Requirements", job.requirements)}
    ${renderModalList("What We Offer", job.benefits)}

    <section class="mt-6 rounded-2xl bg-slate-950 p-5 text-white dark:bg-white dark:text-slate-950">
      <h3 class="text-base font-black">How to Apply</h3>
      <p class="mt-3 text-sm leading-7 opacity-80">${escapeHtml(job.how_to_apply || "")}</p>
      <div class="mt-5 flex flex-col gap-3 sm:flex-row">
        <a class="career-btn inline-flex items-center justify-center gap-2 rounded-full bg-careerGold px-5 py-3 text-sm font-black text-slate-950 hover:bg-white" href="${mailto}">
          <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
          Apply by Email
        </a>
        <button class="career-btn inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-black hover:bg-white/10 dark:border-slate-950/20 dark:hover:bg-slate-950/10" type="button" data-save-job="${job.id}">
          <i class="fa-regular fa-bookmark" aria-hidden="true"></i>
          Save Job
        </button>
      </div>
    </section>
  `;

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeJobModal() {
  const { modal } = getControls();
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function bindEvents() {
  const controls = getControls();

  controls.filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter || "";
    visibleCount = PAGE_SIZE;
    renderFilters();
    applyFilters();
  });

  controls.search.addEventListener("input", () => {
    visibleCount = PAGE_SIZE;
    applyFilters();
  });

  controls.sort.addEventListener("change", applyFilters);

  document.getElementById("reset-jobs")?.addEventListener("click", () => {
    activeFilter = "";
    visibleCount = PAGE_SIZE;
    controls.search.value = "";
    controls.sort.value = "featured";
    renderFilters();
    applyFilters();
  });

  controls.next.addEventListener("click", () => {
    visibleCount = Math.min(filteredJobs.length, visibleCount + PAGE_SIZE);
    renderJobs();
  });

  controls.loadMore.addEventListener("click", () => {
    visibleCount = Math.min(filteredJobs.length, visibleCount + PAGE_SIZE);
    renderJobs();
  });

  controls.grid.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view-job]");
    const saveButton = event.target.closest("[data-save-job]");
    if (viewButton) {
      openJobModal(viewButton.dataset.viewJob);
      return;
    }
    if (saveButton) {
      toggleSave(saveButton.dataset.saveJob);
    }
  });

  controls.modal.addEventListener("click", (event) => {
    if (event.target === controls.modal) {
      closeJobModal();
      return;
    }
    const saveButton = event.target.closest("[data-save-job]");
    if (saveButton) {
      toggleSave(saveButton.dataset.saveJob);
    }
  });

  controls.modalClose.addEventListener("click", closeJobModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeJobModal();
    }
  });

  controls.themeToggle.addEventListener("click", () => {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    controls.themeToggle.innerHTML = `<i class="fa-solid fa-${dark ? "sun" : "moon"}" aria-hidden="true"></i>`;
  });

  controls.postJob.addEventListener("click", () => {
    if (currentProfile?.role === "admin") {
      window.location.href = "/admin.html#jobs-management";
      return;
    }
    showToast("Admin access is required to post job vacancies.", "error");
    window.location.href = "/login.html?next=admin.html";
  });
}

function toggleSave(jobId) {
  const saved = getSavedJobs();
  const key = String(jobId);
  if (saved.has(key)) {
    saved.delete(key);
    showToast("Job removed from saved list.", "success");
  } else {
    saved.add(key);
    showToast("Job saved.", "success");
  }
  setSavedJobs(saved);
  renderJobs();
}

function initParticles() {
  const root = document.getElementById("career-particles");
  if (!root) return;

  root.innerHTML = Array.from({ length: 26 })
    .map((_, index) => {
      const left = Math.round((index * 37) % 100);
      const duration = 9 + (index % 9);
      const delay = -(index % 8);
      const drift = (index % 2 ? "-" : "") + (1 + (index % 7)) + "rem";
      return `<span style="left:${left}%;--duration:${duration}s;--delay:${delay}s;--drift:${drift};"></span>`;
    })
    .join("");
}

function initTheme() {
  const preferred = localStorage.getItem(THEME_KEY);
  const dark = preferred === "dark";
  document.documentElement.classList.toggle("dark", dark);
  const { themeToggle } = getControls();
  if (themeToggle) {
    themeToggle.innerHTML = `<i class="fa-solid fa-${dark ? "sun" : "moon"}" aria-hidden="true"></i>`;
  }
}

function animateStats() {
  document.querySelectorAll("[data-stat-count]").forEach((node) => {
    const target = Number(node.dataset.statCount || 0);
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 32));
    const timer = window.setInterval(() => {
      current = Math.min(target, current + step);
      node.textContent = String(current);
      if (current >= target) {
        window.clearInterval(timer);
      }
    }, 28);
  });
}

async function init() {
  currentProfile = await bootstrapPage("careers");
  initTheme();
  initParticles();
  animateStats();
  renderFilters();
  renderSkeletons();
  bindEvents();

  try {
    allJobs = await listJobs();
    filteredJobs = [...allJobs];
    applyFilters();
  } catch (error) {
    allJobs = [];
    filteredJobs = [];
    renderJobs();
    showToast(error.message || "Unable to load jobs.", "error");
  }
}

init();
