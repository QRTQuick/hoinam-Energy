const OVERLAY_ID = "auth-loading-screen";
const STATE_KEY = "hoinam_auth_loading_state";
const MAX_STATE_AGE_MS = 90 * 1000;

const DEFAULT_STATE = {
  title: "Signing you in",
  copy: "Google sign-in is complete. Hoinam Energy is creating your secure session.",
  steps: ["Google verified", "Syncing account", "Opening dashboard"]
};

function normalizeState(state = {}) {
  const steps = Array.isArray(state.steps) && state.steps.length
    ? state.steps.filter(Boolean)
    : DEFAULT_STATE.steps;

  return {
    title: state.title || DEFAULT_STATE.title,
    copy: state.copy || DEFAULT_STATE.copy,
    steps,
    startedAt: Number(state.startedAt || Date.now()),
    active: true
  };
}

function buildOverlayMarkup(state) {
  return `
    <div class="auth-loading-card">
      <div class="auth-loading-mark">
        <img src="/assets/images/hoinam-logo.png" alt="Hoinam Energy">
      </div>
      <div class="auth-loading-spinner" aria-hidden="true"></div>
      <h2>${state.title}</h2>
      <p>${state.copy}</p>
      <div class="auth-loading-steps">
        ${state.steps.map((step) => `<span>${step}</span>`).join("")}
      </div>
    </div>
  `;
}

function readPersistedState() {
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.active) {
      window.sessionStorage.removeItem(STATE_KEY);
      return null;
    }

    if (Date.now() - Number(parsed.startedAt || 0) > MAX_STATE_AGE_MS) {
      window.sessionStorage.removeItem(STATE_KEY);
      return null;
    }

    return normalizeState(parsed);
  } catch (_error) {
    window.sessionStorage.removeItem(STATE_KEY);
    return null;
  }
}

class AuthLoadingManager {
  show(state = {}) {
    if (!document.body) {
      return null;
    }

    const nextState = normalizeState(state);
    let overlay = document.getElementById(OVERLAY_ID);

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.className = "auth-loading-screen";
      document.body.append(overlay);
    }

    overlay.innerHTML = buildOverlayMarkup(nextState);
    document.body.dataset.authLoading = "true";
    return nextState;
  }

  hide({ clearPersisted = true } = {}) {
    if (document.body) {
      document.body.dataset.authLoading = "false";
    }

    document.getElementById(OVERLAY_ID)?.remove();
    if (clearPersisted) {
      this.clearPersisted();
    }
  }

  persist(state = {}) {
    const nextState = normalizeState(state);
    try {
      window.sessionStorage.setItem(STATE_KEY, JSON.stringify(nextState));
    } catch (_error) {
      // Ignore storage failures and still return the state for on-page rendering.
    }
    return nextState;
  }

  beginNavigation(state = {}) {
    const nextState = this.persist(state);
    this.show(nextState);
    return nextState;
  }

  restorePersisted() {
    const state = readPersistedState();
    if (!state) {
      return null;
    }

    this.show(state);
    return state;
  }

  clearPersisted() {
    try {
      window.sessionStorage.removeItem(STATE_KEY);
    } catch (_error) {
      // Ignore storage failures.
    }
  }
}

export default new AuthLoadingManager();
