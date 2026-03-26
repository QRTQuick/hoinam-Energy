import { syncSession } from "../api.js";
import { bootstrapPage, redirectAfterAuth } from "../app-shell.js";
import {
  buildPhoneVerifier,
  firebaseEnabled,
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  requestPhoneOtp,
  updateCurrentUserName
} from "../firebase.js";
import { showToast } from "../ui.js";

let confirmationResult = null;
let verifier = null;

function normalizePhoneNumber(rawValue) {
  const value = rawValue.trim().replace(/[^\d+]/g, "");
  if (!value) {
    throw new Error("Enter a phone number first.");
  }
  if (value.startsWith("+")) {
    return value;
  }
  if (value.startsWith("0")) {
    return `+234${value.slice(1)}`;
  }
  if (value.startsWith("234")) {
    return `+${value}`;
  }
  throw new Error("Enter a valid phone number like +2348012345678 or 08012345678.");
}

async function completeAuthSuccess() {
  await syncSession();
  showToast("Authentication successful.", "success");
  redirectAfterAuth();
}

async function init() {
  const profile = await bootstrapPage("login");
  if (profile) {
    redirectAfterAuth();
    return;
  }

  if (!firebaseEnabled) {
    document.getElementById("auth-config-note").innerHTML = `
      <div class="empty-state">Add your Firebase web config to assets/js/site-config.js before using sign-in flows.</div>
    `;
  }

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const googleButtons = document.querySelectorAll("[data-google-auth]");
  const phoneCard = document.getElementById("phone-auth-card");

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

  googleButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await loginWithGoogle();
        await completeAuthSuccess();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  });

  if (window.HOINAM_CONFIG?.enablePhoneAuth) {
    phoneCard.classList.remove("hidden");
    document.getElementById("send-otp").addEventListener("click", async () => {
      try {
        const phoneNumber = normalizePhoneNumber(document.getElementById("phone-number").value);
        verifier = verifier || buildPhoneVerifier("recaptcha-container");
        confirmationResult = await requestPhoneOtp(
          phoneNumber,
          verifier
        );
        showToast("OTP sent successfully.", "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    document.getElementById("verify-otp").addEventListener("click", async () => {
      try {
        if (!confirmationResult) {
          throw new Error("Send an OTP first.");
        }
        const otpCode = document.getElementById("otp-code").value.trim();
        if (!otpCode) {
          throw new Error("Enter the OTP code sent to the phone number.");
        }
        await confirmationResult.confirm(otpCode);
        await updateCurrentUserName(document.getElementById("phone-full-name").value.trim());
        await completeAuthSuccess();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }
}

init();
