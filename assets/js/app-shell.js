import { syncSession } from "./api.js";
import { waitForAuthReady } from "./firebase.js";
import { refreshInteractions } from "./interactions.js";
import { clearCachedProfile, getCachedProfile } from "./store.js";
import { injectShell, refreshShell, showToast } from "./ui.js";

export async function bootstrapPage(activePage, options = {}) {
  injectShell(activePage);
  refreshInteractions();

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
    redirectToLogin();
    return null;
  }

  if (options.requireAdmin && profile?.role !== "admin") {
    showToast("Admin access is required for this page.", "error");
    redirectToLogin("admin.html");
    return null;
  }

  return profile;
}

export function redirectToLogin(nextOverride) {
  const next = nextOverride || window.location.pathname.split("/").pop() || "dashboard.html";
  window.location.href = `/login.html?next=${encodeURIComponent(next)}`;
}

export function redirectAfterAuth(fallback = "dashboard.html") {
  const search = new URLSearchParams(window.location.search);
  const next = search.get("next") || fallback;
  window.location.href = `/${next.replace(/^\//, "")}`;
}
