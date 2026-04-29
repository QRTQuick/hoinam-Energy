import { createOrder, getPaymentOptions } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { clearCart, getCart, getCartSubtotal } from "../store.js";
import { formatMoney, showToast } from "../ui.js";

let paymentOptions = [];

function orderItemsFromCart() {
  return getCart().map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity
  }));
}

function selectedPaymentMethod(form) {
  return form.querySelector('input[name="payment_method"]:checked')?.value || "opay_transfer";
}

function optionById(id) {
  return paymentOptions.find((option) => option.id === id);
}

function renderSummary() {
  const cart = getCart();
  const summary = document.getElementById("checkout-summary");

  if (!cart.length) {
    summary.innerHTML = `
      <div class="empty-state">
        Your cart is empty. Add products before checkout.
      </div>
    `;
    return;
  }

  summary.innerHTML = `
    <div class="panel checkout-summary-panel">
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
      <p class="muted checkout-note">Orders are confirmed by Hoinam Energy after transfer confirmation or delivery scheduling.</p>
    </div>
  `;
}

function renderPaymentOptions() {
  const target = document.getElementById("payment-methods");
  if (!target) {
    return;
  }

  target.innerHTML = paymentOptions
    .map(
      (option, index) => `
        <label class="payment-option-card ${index === 0 ? "is-selected" : ""}">
          <input name="payment_method" type="radio" value="${option.id}" ${index === 0 ? "checked" : ""}>
          <span class="payment-option-icon">
            <i class="fa-solid ${option.id === "opay_transfer" ? "fa-building-columns" : "fa-truck-fast"}" aria-hidden="true"></i>
          </span>
          <span class="payment-option-copy">
            <strong>${option.label}</strong>
            <small>${option.description}</small>
            ${
              option.id === "opay_transfer"
                ? `<em>${option.bank_name || "OPay"} ${option.account_number || "account details pending"} ${option.account_name ? `- ${option.account_name}` : ""}</em>`
                : ""
            }
          </span>
        </label>
      `
    )
    .join("");

  target.querySelectorAll('input[name="payment_method"]').forEach((input) => {
    input.addEventListener("change", () => {
      target.querySelectorAll(".payment-option-card").forEach((card) => {
        card.classList.toggle("is-selected", card.contains(input) && input.checked);
      });
    });
  });
}

function renderOrderComplete(order) {
  const status = document.getElementById("checkout-status");
  const method = optionById(order.payment_method);
  const isTransfer = order.payment_method === "opay_transfer";

  status.innerHTML = `
    <div class="panel checkout-complete-panel">
      <span class="badge">${isTransfer ? "Transfer pending" : "Pay on delivery"}</span>
      <h3>Order ${order.order_number} created</h3>
      <p class="muted">
        ${isTransfer
          ? "Use the transfer details below and include your order reference so the admin team can confirm the payment."
          : "Hoinam Energy will contact you to confirm delivery and collect payment."}
      </p>
      ${
        isTransfer
          ? `
            <div class="transfer-details">
              <div><span>Bank</span><strong>${method?.bank_name || "OPay"}</strong></div>
              <div><span>Account number</span><strong>${method?.account_number || "Pending setup"}</strong></div>
              <div><span>Account name</span><strong>${method?.account_name || "Hoinam Energy"}</strong></div>
              <div><span>Reference</span><strong>${order.payment_reference}</strong></div>
            </div>
          `
          : `<p class="checkout-reference">Reference: <strong>${order.payment_reference}</strong></p>`
      }
      <div class="inline-actions">
        <a class="button" href="/dashboard.html">View dashboard</a>
        <a class="button button-ghost" href="/products.html">Continue shopping</a>
      </div>
    </div>
  `;
}

async function init() {
  const profile = await bootstrapPage("cart", { requireAuth: true });
  if (!profile) {
    return;
  }

  renderSummary();

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

  try {
    const optionsPayload = await getPaymentOptions();
    paymentOptions = optionsPayload.methods || [];
    renderPaymentOptions();
  } catch (error) {
    showToast(error.message, "error");
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
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Creating order`;
      const order = await createOrder({
        items: orderItemsFromCart(),
        shipping_address: shippingAddress,
        notes: form.notes.value.trim(),
        payment_method: selectedPaymentMethod(form)
      });

      clearCart();
      form.classList.add("hidden");
      renderOrderComplete(order);
      showToast("Order created successfully.", "success");
    } catch (error) {
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = false;
      submitButton.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Place order`;
      showToast(error.message, "error");
    }
  });
}

init();
