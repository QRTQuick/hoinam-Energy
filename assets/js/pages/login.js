import { syncSession } from "../api.js";
import authLoadingManager from "../auth-loading.js";
import { bootstrapPage, redirectAfterAuth } from "../app-shell.js";
import {
  firebaseEnabled,
  getGoogleRedirectResult,
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  waitForAuthReady
} from "../firebase.js";
import { consumeGuestCartRestore } from "../store.js";
import { showToast } from "../ui.js";

const AUTH_SYNC_STATE = {
  title: "Finalizing your Hoinam Energy session",
  copy: "Checking your account and preparing your secure dashboard access.",
  steps: ["Google verified", "Syncing account", "Opening dashboard"]
};

const DASHBOARD_NAVIGATION_STATE = {
  title: "Opening your dashboard",
  copy: "Your account is ready. Hoinam Energy is taking you to your dashboard now.",
  steps: ["Google verified", "Account ready", "Opening dashboard"]
};

const GOOGLE_PICKER_STATE = {
  title: "Opening Google sign-in",
  copy: "Choose your Google account, then we will bring you back here automatically.",
  steps: ["Connecting to Google", "Waiting for approval", "Returning to Hoinam"]
};

function beginDashboardNavigation() {
  authLoadingManager.beginNavigation(DASHBOARD_NAVIGATION_STATE);
}

function finishAuthNavigation() {
  const explicitNext = new URLSearchParams(window.location.search).get("next");
  const guestCart = consumeGuestCartRestore();
  const fallback = !explicitNext && Number(guestCart?.itemCount || 0) > 0
    ? "cart.html?restoredCart=1"
    : "premium-pricing.html";

  beginDashboardNavigation();
  redirectAfterAuth(fallback);
}

async function completeAuthSuccess() {
  authLoadingManager.show(AUTH_SYNC_STATE);
  await syncSession();
  finishAuthNavigation();
}

function formatAuthError(error) {
  const message = error?.message || "Unable to complete sign-in. Please try again.";
  if (message.toLowerCase().includes("full name is already in use")) {
    return "That full name is already in use. Please choose a different full name and try again.";
  }
  return message;
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForProfileSync({ attempts = 18, delayMs = 500 } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const profile = await syncSession();
      if (profile) {
        return profile;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(delayMs);
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

async function handleGoogleRedirect() {
  if (!firebaseEnabled) {
    return false;
  }

  let hadRedirectResult = false;

  try {
    authLoadingManager.show(AUTH_SYNC_STATE);
    const result = await getGoogleRedirectResult();
    hadRedirectResult = Boolean(result?.user);
  } catch (error) {
    authLoadingManager.hide();
    showToast(formatAuthError(error), "error");
    return false;
  }

  const user = await waitForAuthReady();
  if (!user && !hadRedirectResult) {
    authLoadingManager.hide();
    return false;
  }

  try {
    const profile = await waitForProfileSync();
    if (!profile) {
      authLoadingManager.hide();
      showToast("Google sign-in completed, but the session could not be restored yet. Please try again.", "error");
      return false;
    }

    finishAuthNavigation();
    return true;
  } catch (error) {
    authLoadingManager.hide();
    showToast(formatAuthError(error), "error");
    return false;
  }
}

async function init() {
  const activePage = document.body.dataset.page || "login";
  if (await handleGoogleRedirect()) {
    return;
  }

  const profile = await bootstrapPage(activePage);
  if (profile) {
    beginDashboardNavigation();
    redirectAfterAuth();
    return;
  }

  const authConfigNote = document.getElementById("auth-config-note");
  if (!firebaseEnabled && authConfigNote) {
    authConfigNote.innerHTML = `
      <div class="empty-state">Add your Firebase web config to assets/js/site-config.js before using sign-in flows.</div>
    `;
  }

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const googleButtons = document.querySelectorAll("[data-google-auth]");

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        authLoadingManager.show({
          title: "Signing you in",
          copy: "Validating your details and preparing your dashboard access.",
          steps: ["Checking details", "Syncing account", "Opening dashboard"]
        });
        await loginWithEmail({
          email: loginForm.email.value.trim(),
          password: loginForm.password.value
        });
        await completeAuthSuccess();
      } catch (error) {
        authLoadingManager.hide();
        showToast(formatAuthError(error), "error");
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        authLoadingManager.show({
          title: "Creating your account",
          copy: "Saving your details and preparing your dashboard access.",
          steps: ["Creating account", "Syncing profile", "Opening dashboard"]
        });
        await registerWithEmail({
          name: registerForm.full_name.value.trim(),
          email: registerForm.email.value.trim(),
          password: registerForm.password.value
        });
        await completeAuthSuccess();
      } catch (error) {
        authLoadingManager.hide();
        showToast(formatAuthError(error), "error");
      }
    });
  }

  googleButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        authLoadingManager.beginNavigation(GOOGLE_PICKER_STATE);
        await loginWithGoogle();
      } catch (error) {
        authLoadingManager.hide();
        showToast(formatAuthError(error), "error");
      }
    });
  });
}

init();
