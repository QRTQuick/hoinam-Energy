import { clearCachedProfile, setCachedProfile } from "./store.js";
import { getCurrentToken } from "./firebase.js";

const apiBase = (window.HOINAM_CONFIG?.apiBaseUrl || `${window.location.origin}/api`).replace(/\/$/, "");

function buildUrl(path) {
  if (path.startsWith("http")) {
    return path;
  }
  return `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch(path, options = {}) {
  const {
    method = "GET",
    body,
    authRequired = false,
    formData,
    headers = {}
  } = options;

  const requestHeaders = { ...headers };
  const token = await getCurrentToken();
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (authRequired && !requestHeaders.Authorization) {
    throw new Error("You need to sign in to continue.");
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: formData ? requestHeaders : { "Content-Type": "application/json", ...requestHeaders },
    body: formData ? formData : body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || "The request could not be completed.");
  }

  return payload.data;
}

export async function syncSession() {
  const token = await getCurrentToken();
  if (!token) {
    clearCachedProfile();
    return null;
  }

  const profile = await apiFetch("/auth/verify", {
    method: "POST",
    body: { idToken: token }
  });
  setCachedProfile(profile);
  return profile;
}

export async function updateProfile(payload) {
  const profile = await apiFetch("/profile", {
    method: "PUT",
    authRequired: true,
    body: payload
  });
  setCachedProfile(profile);
  return profile;
}

export function listProducts() {
  return apiFetch("/products");
}

export function getProduct(productId) {
  return apiFetch(`/products/${productId}`);
}

export function initializePayment(items) {
  return apiFetch("/payments/initialize", {
    method: "POST",
    authRequired: true,
    body: { items }
  });
}

export function createOrder(payload) {
  return apiFetch("/orders", {
    method: "POST",
    authRequired: true,
    body: payload
  });
}

export function getUserOrders() {
  return apiFetch("/orders/user", { authRequired: true });
}

export function getAdminOrders() {
  return apiFetch("/orders", { authRequired: true });
}

export function createInstallation(payload) {
  return apiFetch("/installations", {
    method: "POST",
    authRequired: true,
    body: payload
  });
}

export function getUserInstallations() {
  return apiFetch("/installations/user", { authRequired: true });
}

export function getAdminInstallations() {
  return apiFetch("/installations", { authRequired: true });
}

export function updateInstallationAdmin(installationId, payload) {
  return apiFetch(`/installations/${installationId}`, {
    method: "PUT",
    authRequired: true,
    body: payload
  });
}

export function getAdminUsers() {
  return apiFetch("/users", { authRequired: true });
}

export function getAdminStats() {
  return apiFetch("/admin/stats", { authRequired: true });
}

export function uploadInventory(file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch("/admin/upload-inventory", {
    method: "POST",
    authRequired: true,
    formData
  });
}

export function createProduct(payload) {
  return apiFetch("/products", {
    method: "POST",
    authRequired: true,
    body: payload
  });
}

export function updateProduct(productId, payload) {
  return apiFetch(`/products/${productId}`, {
    method: "PUT",
    authRequired: true,
    body: payload
  });
}

export function archiveProduct(productId) {
  return apiFetch(`/products/${productId}`, {
    method: "DELETE",
    authRequired: true
  });
}
