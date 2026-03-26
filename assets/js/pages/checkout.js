import { createOrder, initializePayment } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { clearCart, clearPendingOrder, getCart, getCartSubtotal, getPendingOrder, setPendingOrder } from "../store.js";
import { formatMoney, showToast } from "../ui.js";

function orderItemsFromCart() {
  return getCart().map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity
  }));
}

function renderSummary() {
  const cart = getCart();
  const summary = document.getElementById("checkout-summary");

  if (!cart.length) {
    summary.innerHTML = `
      <div class="empty-state">
        Your cart is empty. Add products before starting Paystack checkout.
      </div>
    `;
    return;
  }

  summary.innerHTML = `
    <div class="panel">
      <h3>Order summary</h3>
      <div class="summary-list">
        ${cart
          .map(
            (item) => `
              <div class="summary-row">
                <span>${item.name} x ${item.quantity}</span>
                <strong>${formatMoney(item.price * item.quantity, item.currency)}</strong>
              </div>
            `
          )
          .join("")}
        <div class="summary-row">
          <span>Total</span>
          <strong class="price">${formatMoney(getCartSubtotal())}</strong>
        </div>
      </div>
    </div>
  `;
}

async function finalizePendingOrder(reference) {
  const status = document.getElementById("checkout-status");
  const pendingOrder = getPendingOrder();

  if (!pendingOrder) {
    status.innerHTML = `<div class="empty-state">Payment reference detected, but no pending order was found in this browser session.</div>`;
    return;
  }

  status.innerHTML = `<div class="panel"><h3>Verifying payment</h3><p class="muted">Please wait while we confirm your Paystack transaction and create the order.</p></div>`;

  try {
    const order = await createOrder({
      items: pendingOrder.items,
      shipping_address: pendingOrder.shipping_address,
      notes: pendingOrder.notes,
      payment_reference: reference
    });

    clearPendingOrder();
    clearCart();
    status.innerHTML = `
      <div class="panel">
        <span class="badge">Payment confirmed</span>
        <h3>Order ${order.order_number} created</h3>
        <p class="muted">Your payment has been verified and the order is now in the Hoinam Energy dashboard.</p>
        <div class="inline-actions">
          <a class="button" href="/dashboard.html">View dashboard</a>
          <a class="button button-ghost" href="/products.html">Continue shopping</a>
        </div>
      </div>
    `;
    showToast("Payment verified and order created.", "success");
    window.history.replaceState({}, document.title, "/checkout.html");
  } catch (error) {
    status.innerHTML = `<div class="empty-state">${error.message}</div>`;
    showToast(error.message, "error");
  }
}

async function init() {
  const profile = await bootstrapPage("cart", { requireAuth: true });
  if (!profile) {
    return;
  }

  renderSummary();

  const params = new URLSearchParams(window.location.search);
  const reference = params.get("reference") || params.get("trxref");
  if (reference) {
    await finalizePendingOrder(reference);
    return;
  }

  const form = document.getElementById("checkout-form");
  const cart = getCart();
  if (!cart.length) {
    document.getElementById("checkout-status").innerHTML = `
      <div class="empty-state">
        Add a product before starting checkout.
      </div>
    `;
    form.classList.add("hidden");
    return;
  }

  form.full_name.value = profile.full_name || "";
  form.phone.value = profile.phone || "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const shippingAddress = {
      full_name: form.full_name.value.trim(),
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
      city: form.city.value.trim(),
      state: form.state.value.trim()
    };

    try {
      const payment = await initializePayment(orderItemsFromCart());
      setPendingOrder({
        items: orderItemsFromCart(),
        shipping_address: shippingAddress,
        notes: form.notes.value.trim()
      });
      showToast("Redirecting to Paystack for payment.", "info");
      window.location.href = payment.authorization_url;
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

init();
