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
  await syncSession();
  showToast("Authentication successful.", "success");
  redirectAfterAuth();
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
    const result = await getGoogleRedirectResult();
    hadRedirectResult = Boolean(result?.user);
  } catch (error) {
    showToast(error.message, "error");
    return false;
  }

  const user = await waitForAuthReady();
  if (!user && !hadRedirectResult) {
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
        showToast(error.message, "error");
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
        showToast(error.message, "error");
      }
    });
  }

  googleButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await loginWithGoogle();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  });
}

init();
