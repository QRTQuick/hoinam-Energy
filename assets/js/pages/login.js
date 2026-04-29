import { syncSession } from "../api.js";
import { bootstrapPage, redirectAfterAuth } from "../app-shell.js";
import {
  firebaseEnabled,
  getGoogleRedirectResult,
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  waitForAuthReady
} from "../firebase.js";
import { showToast } from "../ui.js";

async function completeAuthSuccess() {
  showAuthLoading("Finalizing your Hoinam Energy session", "Checking your account and opening your dashboard.");
  await syncSession();
  showToast("Authentication successful.", "success");
  redirectAfterAuth();
}

function showAuthLoading(title = "Signing you in", copy = "Google sign-in is complete. Hoinam Energy is creating your secure session.") {
  let loader = document.getElementById("auth-loading-screen");
  if (!loader) {
    loader = document.createElement("div");
    loader.id = "auth-loading-screen";
    loader.className = "auth-loading-screen";
    document.body.append(loader);
  }

  loader.innerHTML = `
    <div class="auth-loading-card">
      <div class="auth-loading-mark">
        <img src="/assets/images/hoinam-logo.png" alt="Hoinam Energy">
      </div>
      <div class="auth-loading-spinner" aria-hidden="true"></div>
      <h2>${title}</h2>
      <p>${copy}</p>
      <div class="auth-loading-steps">
        <span>Google verified</span>
        <span>Syncing account</span>
        <span>Opening dashboard</span>
      </div>
    </div>
  `;
  document.body.dataset.authLoading = "true";
}

function hideAuthLoading() {
  document.body.dataset.authLoading = "false";
  document.getElementById("auth-loading-screen")?.remove();
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

async function handleGoogleRedirect() {
  if (!firebaseEnabled) {
    return false;
  }

  let hadRedirectResult = false;

  try {
    showAuthLoading();
    const result = await getGoogleRedirectResult();
    hadRedirectResult = Boolean(result?.user);
  } catch (error) {
    hideAuthLoading();
    showToast(formatAuthError(error), "error");
    return false;
  }

  const user = await waitForAuthReady();
  if (!user && !hadRedirectResult) {
    hideAuthLoading();
    return false;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const profile = await syncSession();
    if (profile) {
      showToast("Authentication successful.", "success");
      redirectAfterAuth();
      return true;
    }
    await sleep(250);
  }

  hideAuthLoading();
  showToast("Google sign-in completed, but the session could not be restored yet. Please try again.", "error");
  return false;
}

async function init() {
  const activePage = document.body.dataset.page || "login";
  if (await handleGoogleRedirect()) {
    return;
  }

  const profile = await bootstrapPage(activePage);
  if (profile) {
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
        await loginWithEmail({
          email: loginForm.email.value.trim(),
          password: loginForm.password.value
        });
        await completeAuthSuccess();
      } catch (error) {
        hideAuthLoading();
        showToast(formatAuthError(error), "error");
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await registerWithEmail({
          name: registerForm.full_name.value.trim(),
          email: registerForm.email.value.trim(),
          password: registerForm.password.value
        });
        await completeAuthSuccess();
      } catch (error) {
        hideAuthLoading();
        showToast(formatAuthError(error), "error");
      }
    });
  }

  googleButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        showAuthLoading("Opening Google sign-in", "Choose your Google account, then we will bring you back here automatically.");
        await loginWithGoogle();
      } catch (error) {
        hideAuthLoading();
        showToast(formatAuthError(error), "error");
      }
    });
  });
}

init();
