import { bootstrapPage } from "../app-shell.js";
import { getCart, getCartSubtotal, removeCartItem, updateCartItem } from "../store.js";
import { formatMoney, refreshShell, showToast } from "../ui.js";

function cartThumb(item) {
  if (item.image_url) {
    return `<img src="${item.image_url}" alt="${item.name}">`;
  }
  const initials = item.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return initials || "HE";
}

function renderCart() {
  const target = document.getElementById("cart-list");
  const summary = document.getElementById("cart-summary");
  const cart = getCart();

  if (!cart.length) {
    target.innerHTML = `<div class="empty-state">Your cart is empty. Start with the EcoFlow catalog.</div>`;
    summary.innerHTML = `
      <div class="panel">
        <h3>Cart summary</h3>
        <p class="muted">Add a product to begin checkout.</p>
        <a class="button button-full" href="/products.html">Browse products</a>
      </div>
    `;
    refreshShell();
    return;
  }

  target.innerHTML = cart
    .map(
      (item) => `
        <article class="panel cart-row" data-item-id="${item.product_id}">
          <div class="cart-item">
            <div class="cart-thumb">${cartThumb(item)}</div>
            <div>
              <h3>${item.name}</h3>
              <p class="muted">${formatMoney(item.price, item.currency)} each</p>
            </div>
          </div>
          <div class="inline-actions">
            <div class="quantity-control">
              <button type="button" data-action="decrease" data-id="${item.product_id}">-</button>
              <span>${item.quantity}</span>
              <button type="button" data-action="increase" data-id="${item.product_id}">+</button>
            </div>
            <strong class="price">${formatMoney(item.price * item.quantity, item.currency)}</strong>
            <button class="button button-danger" type="button" data-action="remove" data-id="${item.product_id}">Remove</button>
          </div>
        </article>
      `
    )
    .join("");

  summary.innerHTML = `
    <div class="panel">
      <h3>Cart summary</h3>
      <div class="summary-list">
        <div class="summary-row">
          <span>Subtotal</span>
          <strong>${formatMoney(getCartSubtotal())}</strong>
        </div>
        <div class="summary-row">
          <span>Checkout</span>
          <span>Handled securely with Paystack</span>
        </div>
      </div>
      <div class="inline-actions">
        <a class="button button-full" href="/checkout.html">Proceed to checkout</a>
      </div>
    </div>
  `;

  refreshShell();
}

async function init() {
  await bootstrapPage("cart");
  renderCart();

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const productId = Number(button.dataset.id);
    const action = button.dataset.action;
    const cart = getCart();
    const item = cart.find((entry) => entry.product_id === productId);
    if (!item) {
      return;
    }

    if (action === "increase") {
      updateCartItem(productId, item.quantity + 1);
    }

    if (action === "decrease") {
      if (item.quantity <= 1) {
        removeCartItem(productId);
      } else {
        updateCartItem(productId, item.quantity - 1);
      }
    }

    if (action === "remove") {
      removeCartItem(productId);
      showToast(`${item.name} removed from cart.`, "info");
    }

    renderCart();
  });
}

init();
