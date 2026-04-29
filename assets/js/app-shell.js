import { syncSession } from "./api.js";
import authLoadingManager from "./auth-loading.js";
import { waitForAuthReady } from "./firebase.js";
import { refreshInteractions } from "./interactions.js";
import { clearCachedProfile, getCachedProfile } from "./store.js";
import { injectShell, refreshShell, showToast } from "./ui.js";
import { MouseGlow } from "./mouse-glow.js";

export async function bootstrapPage(activePage, options = {}) {
  const restoredAuthLoading = authLoadingManager.restorePersisted();
  document.body.dataset.page = activePage;
  injectShell(activePage);
  refreshInteractions();

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
