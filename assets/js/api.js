import { clearCachedProfile, setCachedProfile } from "./store.js";
import { getCurrentToken } from "./firebase.js";

const apiBase = (window.HOINAM_CONFIG?.apiBaseUrl || `${window.location.origin}/api`).replace(/\/$/, "");

// Simple logger that outputs to console in development
const apiLogger = {
  debug: (msg, data) => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      console.log(`[API Debug] ${msg}`, data || "");
    }
  },
  warn: (msg, data) => console.warn(`[API Warning] ${msg}`, data || ""),
  error: (msg, data) => console.error(`[API Error] ${msg}`, data || ""),
};

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
    headers = {},
    retries = 1,
  } = options;

  const requestHeaders = { ...headers };
  const token = await getCurrentToken();
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (authRequired && !requestHeaders.Authorization) {
    const error = new Error("You need to sign in to continue.");
    apiLogger.warn("Auth required but no token available", { path, method });
    throw error;
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      apiLogger.debug(`API Call [${method}] ${path}${attempt > 0 ? ` (attempt ${attempt + 1})` : ""}`);
      
      const response = await fetch(buildUrl(path), {
        method,
        headers: formData ? requestHeaders : { "Content-Type": "application/json", ...requestHeaders },
        body: formData ? formData : body ? JSON.stringify(body) : undefined
      });

      const payload = await response.json().catch(() => ({}));
      
      if (!response.ok || payload.success === false) {
        const errorMessage = payload.message || `Request failed with status ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.payload = payload;
        
        // Attach structured error data for special cases like stock errors
        if (payload.error_type) {
          error.errorType = payload.error_type;
          error.errorData = payload;
        }

        apiLogger.warn(`API Error [${response.status}] ${path}`, {
          message: errorMessage,
          payload,
        });

        // Don't retry on auth/validation errors
        if (response.status === 401 || response.status === 400 || response.status === 409) {
          throw error;
        }

        lastError = error;
        if (attempt < retries) {
          // Exponential backoff: 100ms, 200ms, etc.
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        }
        throw error;
      }

      apiLogger.debug(`API Success [${response.status}] ${path}`);
      return payload.data;
    } catch (err) {
      lastError = err;
      if (attempt < retries && err.status !== 401 && err.status !== 400 && err.status !== 409) {
        apiLogger.debug(`Retrying ${path} after error...`);
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Request failed after retries");
}

// Like apiFetch but returns { data, message } so callers can read the server message.
export async function apiFetchFull(path, options = {}) {
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
    const error = new Error(payload.message || "The request could not be completed.");
    error.status = response.status;
    apiLogger.error(`API Error [${response.status}] ${path}`, { message: payload.message });
    throw error;
  }

  return { data: payload.data, message: payload.message };
}

export async function syncSession() {
  const token = await getCurrentToken();
  if (!token) {
    clearCachedProfile();
    apiLogger.debug("No auth token available, clearing session");
    return null;
  }

  try {
    apiLogger.debug("Syncing session...");
    const profile = await apiFetch("/auth/verify", {
      method: "POST",
      body: { idToken: token },
      retries: 2, // Retry session verification up to 2 times
    });
    apiLogger.debug("Session synced successfully", { email: profile?.email });
    setCachedProfile(profile);
    return profile;
  } catch (error) {
    apiLogger.error("Session sync failed", {
      status: error.status,
      message: error.message,
    });
    clearCachedProfile();
    throw error; // Re-throw so the caller can handle it
  }
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

export function listJobs() {
  return apiFetch("/jobs");
}

export function getJob(jobId) {
  return apiFetch(`/jobs/${jobId}`);
}

export function getAdminJobs() {
  return apiFetch("/admin/jobs", { authRequired: true });
}

export function createJob(payload) {
  return apiFetch("/admin/jobs", {
    method: "POST",
    authRequired: true,
    body: payload
  });
}

export function updateJob(jobId, payload) {
  return apiFetch(`/admin/jobs/${jobId}`, {
    method: "PUT",
    authRequired: true,
    body: payload
  });
}

export function deleteJob(jobId) {
  return apiFetch(`/admin/jobs/${jobId}`, {
    method: "DELETE",
    authRequired: true
  });
}

export function getPaymentOptions() {
  return apiFetch("/payment-options");
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

export function getPendingDeliveries() {
  return apiFetch("/admin/pending-deliveries", { authRequired: true });
}

export function confirmDelivery(orderId, payload = {}) {
  return apiFetch(`/admin/orders/${orderId}/confirm-delivery`, {
    method: "POST",
    authRequired: true,
    body: payload
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

export function listBlogPosts() {
  return apiFetch("/blog");
}

export function getBlogPost(slug) {
  return apiFetch(`/blog/${slug}`);
}

export function getAdminBlogPosts() {
  return apiFetch("/admin/blog", { authRequired: true });
}

export function createBlogPost(payload) {
  return apiFetch("/admin/blog", {
    method: "POST",
    authRequired: true,
    body: payload
  });
}

export function updateBlogPost(postId, payload) {
  return apiFetch(`/admin/blog/${postId}`, {
    method: "PUT",
    authRequired: true,
    body: payload
  });
}

export function deleteBlogPost(postId) {
  return apiFetch(`/admin/blog/${postId}`, {
    method: "DELETE",
    authRequired: true
  });
}

export function uploadPaymentReceipt(verificationCode, file) {
  const formData = new FormData();
  formData.append("receipt", file);
  return apiFetch(`/payments/${verificationCode}/receipt`, {
    method: "POST",
    authRequired: true,
    formData
  });
}

export function getOrderPayment(verificationCode) {
  return apiFetch(`/payments/${verificationCode}`, { authRequired: true });
}

export function subscribeToBlog(email, name = "") {
  return apiFetchFull("/blog/subscribe", {
    method: "POST",
    body: { email, name }
  });
}

export function unsubscribeFromBlog(token) {
  return apiFetch(`/blog/unsubscribe/${token}`);
}

export function submitFeedback(payload) {
  return apiFetch("/feedback", {
    method: "POST",
    body: payload
  });
}

export function getAdminFeedback() {
  return apiFetch("/admin/feedback", { authRequired: true });
}

export function validateCoupon(code, subtotal) {
  return apiFetch("/coupons/validate", {
    method: "POST",
    body: { code, subtotal }
  });
}

export function getAdminCoupons() {
  return apiFetch("/admin/coupons", { authRequired: true });
}

export function createCoupon(payload) {
  return apiFetch("/admin/coupons", {
    method: "POST",
    authRequired: true,
    body: payload
  });
}

export function updateCoupon(couponId, payload) {
  return apiFetch(`/admin/coupons/${couponId}`, {
    method: "PUT",
    authRequired: true,
    body: payload
  });
}

export function deleteCoupon(couponId) {
  return apiFetch(`/admin/coupons/${couponId}`, {
    method: "DELETE",
    authRequired: true
  });
}

export function getSeason() {
  return apiFetch("/season");
}

export function setSeason(payload) {
  return apiFetch("/admin/season", {
    method: "POST",
    authRequired: true,
    body: payload
  });
}
