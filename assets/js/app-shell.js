import { syncSession } from "./api.js";
import authLoadingManager from "./auth-loading.js";
import { waitForAuthReady } from "./firebase.js";
import { refreshInteractions } from "./interactions.js";
import { clearCachedProfile, getCachedProfile } from "./store.js";
import { injectShell, refreshShell, showToast } from "./ui.js";
import { MouseGlow } from "./mouse-glow.js";

// ── Season theme ──────────────────────────────────────────────────────────────
const SEASON_CACHE_KEY = "hoinam_season_cache";
const SEASON_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const SEASON_META = {
  default:      { label: "Default",         emoji: "",   accent: null,      bg: null },
  christmas:    { label: "Christmas",        emoji: "🎄", accent: "#c0392b", bg: "christmas" },
  new_year:     { label: "New Year",         emoji: "🎆", accent: "#0055b8", bg: "new_year" },
  easter:       { label: "Easter",           emoji: "🐣", accent: "#27ae60", bg: "easter" },
  eid:          { label: "Eid",              emoji: "🌙", accent: "#1a5276", bg: "eid" },
  independence: { label: "Independence Day", emoji: "🇳🇬", accent: "#008751", bg: "independence" },
  valentine:    { label: "Valentine's Day",  emoji: "❤️", accent: "#c0392b", bg: "valentine" },
  halloween:    { label: "Halloween",        emoji: "🎃", accent: "#e67e22", bg: "halloween" },
  custom:       { label: "Custom",           emoji: "✨", accent: null,      bg: "custom" },
};

async function loadAndApplySeason() {
  try {
    // Try cache first
    const cached = sessionStorage.getItem(SEASON_CACHE_KEY);
    if (cached) {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < SEASON_CACHE_TTL) {
        applySeason(data);
        return;
      }
    }

    const apiBase = (window.HOINAM_CONFIG?.apiBaseUrl || `${window.location.origin}/api`).replace(/\/$/, "");
    const res = await fetch(`${apiBase}/season`);
    if (res.ok) {
      const payload = await res.json();
      const data = payload.data || {};
      sessionStorage.setItem(SEASON_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
      applySeason(data);
    }
  } catch (_) {
    // Non-critical — silently ignore
  }
}

function applySeason(data) {
  if (!data || !data.active || data.season === "default") {
    document.documentElement.removeAttribute("data-season");
    document.getElementById("season-banner")?.remove();
    return;
  }

  document.documentElement.setAttribute("data-season", data.season);

  // Banner
  if (data.banner) {
    let banner = document.getElementById("season-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "season-banner";
      banner.className = "season-banner";
      document.body.prepend(banner);
    }
    const meta = SEASON_META[data.season] || SEASON_META.custom;
    banner.innerHTML = `<span>${meta.emoji ? meta.emoji + " " : ""}${data.banner}${meta.emoji ? " " + meta.emoji : ""}</span>`;
  } else {
    document.getElementById("season-banner")?.remove();
  }
}

export { loadAndApplySeason, applySeason, SEASON_META };

export async function bootstrapPage(activePage, options = {}) {
  const restoredAuthLoading = authLoadingManager.restorePersisted();
  document.body.dataset.page = activePage;
  injectShell(activePage);
  refreshInteractions();

  // Apply seasonal theme (non-blocking)
  loadAndApplySeason();

  // Initialize mouse glow effect
  if (!window.mouseGlow) {
    window.mouseGlow = new MouseGlow({
      enabled: true,
      glowSize: 400,
      glowOpacity: 0.12,
      glowColor: "rgba(102, 126, 234, 0.4)",
      blurAmount: 80
    });
  }

  let profile = getCachedProfile();

  try {
    const user = await waitForAuthReady();
    if (user) {
      profile = await syncSession();
    } else {
      clearCachedProfile();
      profile = null;
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || "Unable to complete sign-in sync.", "error");
  }

  refreshShell();

  if (options.requireAuth && !profile) {
    authLoadingManager.hide();
    redirectToLogin();
    return null;
  }

  if (options.requireAdmin && profile?.role !== "admin") {
    authLoadingManager.hide();
    showToast("Admin access is required for this page.", "error");
    redirectToLogin("admin.html");
    return null;
  }

  if (restoredAuthLoading && !options.preserveAuthLoading) {
    authLoadingManager.hide();
  }

  return profile;
}

export function redirectToLogin(nextOverride) {
  authLoadingManager.clearPersisted();
  const next = nextOverride || window.location.pathname.split("/").pop() || "dashboard.html";
  window.location.href = `/login.html?next=${encodeURIComponent(next)}`;
}

export function redirectAfterAuth(fallback = "dashboard.html") {
  const search = new URLSearchParams(window.location.search);
  const next = search.get("next") || fallback;
  window.location.href = `/${next.replace(/^\//, "")}`;
}
