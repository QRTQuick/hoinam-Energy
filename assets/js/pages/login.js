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

const GOOGLE_REDIRECT_KEY = "hoinam_google_redirect";

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

async function resumeGoogleRedirectIfNeeded() {
  const pendingGoogleRedirect = window.sessionStorage.getItem(GOOGLE_REDIRECT_KEY) === "1";
  if (!pendingGoogleRedirect || !firebaseEnabled) {
    return false;
  }

  try {
    await getGoogleRedirectResult();
    await waitForAuthReady();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const profile = await syncSession();
      if (profile) {
        window.sessionStorage.removeItem(GOOGLE_REDIRECT_KEY);
        showToast("Authentication successful.", "success");
        redirectAfterAuth();
        return true;
      }
      await sleep(250);
    }

    throw new Error("Google sign-in completed, but the session could not be restored yet. Please try again.");
  } catch (error) {
    window.sessionStorage.removeItem(GOOGLE_REDIRECT_KEY);
    showToast(error.message, "error");
    return false;
  }
}

async function init() {
  const activePage = document.body.dataset.page || "login";
  if (await resumeGoogleRedirectIfNeeded()) {
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
        window.sessionStorage.setItem(GOOGLE_REDIRECT_KEY, "1");
        await loginWithGoogle();
      } catch (error) {
        window.sessionStorage.removeItem(GOOGLE_REDIRECT_KEY);
        showToast(error.message, "error");
      }
    });
  });
}

init();
