import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  getRedirectResult,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithRedirect,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = window.HOINAM_CONFIG?.firebase || {};
export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

export const app = firebaseEnabled ? initializeApp(firebaseConfig) : null;
export const auth = firebaseEnabled ? getAuth(app) : null;

if (auth) {
  auth.languageCode = "en";
}

export function ensureFirebase() {
  if (!firebaseEnabled || !auth) {
    throw new Error("Firebase client config is missing in assets/js/site-config.js.");
  }
}

export function waitForAuthReady() {
  return new Promise((resolve) => {
    if (!auth) {
      resolve(null);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getCurrentToken(forceRefresh = false) {
  if (!auth?.currentUser) {
    return null;
  }
  return auth.currentUser.getIdToken(forceRefresh);
}

export async function registerWithEmail({ name, email, password }) {
  ensureFirebase();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(credential.user, { displayName: name });
  }
  return credential.user;
}

export async function loginWithEmail({ email, password }) {
  ensureFirebase();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function loginWithGoogle() {
  ensureFirebase();
  const provider = new GoogleAuthProvider();
  await signInWithRedirect(auth, provider);
  return null;
}

export async function getGoogleRedirectResult() {
  ensureFirebase();
  return getRedirectResult(auth);
}

export async function updateCurrentUserName(name) {
  ensureFirebase();
  if (!auth?.currentUser || !name?.trim()) {
    return auth?.currentUser || null;
  }
  await updateProfile(auth.currentUser, { displayName: name.trim() });
  return auth.currentUser;
}

export async function logoutUser() {
  if (!auth) {
    return;
  }
  await signOut(auth);
}

export function buildPhoneVerifier(containerId = "recaptcha-container") {
  ensureFirebase();
  return new RecaptchaVerifier(auth, containerId, {
    size: "normal"
  });
}

export async function requestPhoneOtp(phoneNumber, appVerifier) {
  ensureFirebase();
  const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  return confirmation;
}
