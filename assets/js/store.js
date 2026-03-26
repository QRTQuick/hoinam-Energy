const CART_KEY = "hoinam_cart";
const PROFILE_KEY = "hoinam_profile";
const PENDING_ORDER_KEY = "hoinam_pending_order";

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getCart() {
  return readStorage(CART_KEY, []);
}

export function saveCart(cart) {
  writeStorage(CART_KEY, cart);
  return cart;
}

export function clearCart() {
  window.localStorage.removeItem(CART_KEY);
}

export function addToCart(product, quantity = 1) {
  const cart = getCart();
  const productId = Number(product.id);
  const nextQuantity = Number(quantity) || 1;
  const existing = cart.find((item) => item.product_id === productId);

  if (existing) {
    existing.quantity += nextQuantity;
  } else {
    cart.push({
      product_id: productId,
      name: product.name,
      slug: product.slug,
      price: Number(product.price || 0),
      currency: product.currency || "NGN",
      image_url: product.image_url || "",
      quantity: nextQuantity
    });
  }

  return saveCart(cart);
}

export function updateCartItem(productId, quantity) {
  const cart = getCart();
  const target = cart.find((item) => item.product_id === Number(productId));
  if (!target) {
    return cart;
  }
  target.quantity = Math.max(1, Number(quantity) || 1);
  return saveCart(cart);
}

export function removeCartItem(productId) {
  const cart = getCart().filter((item) => item.product_id !== Number(productId));
  return saveCart(cart);
}

export function getCartCount() {
  return getCart().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

export function getCartSubtotal() {
  return getCart().reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
}

export function setCachedProfile(profile) {
  writeStorage(PROFILE_KEY, profile);
}

export function getCachedProfile() {
  return readStorage(PROFILE_KEY, null);
}

export function clearCachedProfile() {
  window.localStorage.removeItem(PROFILE_KEY);
}

export function setPendingOrder(orderData) {
  writeStorage(PENDING_ORDER_KEY, orderData);
}

export function getPendingOrder() {
  return readStorage(PENDING_ORDER_KEY, null);
}

export function clearPendingOrder() {
  window.localStorage.removeItem(PENDING_ORDER_KEY);
}
