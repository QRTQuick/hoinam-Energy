import { createOrder, getPaymentOptions } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { clearCart, getCart, getCartSubtotal } from "../store.js";
import { formatDate, formatMoney, showToast } from "../ui.js";

let paymentOptions = [];

function orderItemsFromCart() {
  return getCart().map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity
  }));
}

function transferOptions() {
  return paymentOptions.filter((option) => option.id !== "pay_on_delivery");
}

function selectedCheckoutMode(form) {
  return form.querySelector('input[name="payment_mode"]:checked')?.value || (transferOptions().length ? "transfer" : "pay_on_delivery");
}

function selectedTransferAccountId(form) {
  return form.querySelector('input[name="transfer_account"]:checked')?.value || transferOptions()[0]?.id || "";
}

function selectedPaymentMethod(form) {
  return selectedCheckoutMode(form) === "pay_on_delivery"
    ? "pay_on_delivery"
    : selectedTransferAccountId(form) || "opay_transfer";
}

function optionById(id) {
  return paymentOptions.find((option) => option.id === id);
}

function paymentDetailsForOrder(order) {
  const selectedOption = optionById(order.payment_method) || {};
  return {
    id: order.payment_method,
    kind: order.payment_method === "pay_on_delivery" ? "delivery" : "transfer",
    label: selectedOption.label || (order.payment_method === "pay_on_delivery" ? "Pay on delivery" : "Bank transfer"),
    description: selectedOption.description || "",
    bank_name: selectedOption.bank_name || "",
    account_number: selectedOption.account_number || "",
    account_name: selectedOption.account_name || "",
    ...(order.payment_details || {})
  };
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

function transferCardMarkup(option, checked) {
  return `
    <label class="payment-option-card ${checked ? "is-selected" : ""}">
      <input name="transfer_account" type="radio" value="${option.id}" ${checked ? "checked" : ""}>
      <span class="payment-option-icon">
        <i class="fa-solid fa-building-columns" aria-hidden="true"></i>
      </span>
      <span class="payment-option-copy">
        <strong>${option.label}</strong>
        <small>${option.description}</small>
        <em>${option.bank_name || "Bank"} ${option.account_number || "account details pending"}${option.account_name ? ` - ${option.account_name}` : ""}</em>
      </span>
    </label>
  `;
}

function syncSelectionCards(container, inputName) {
  container.querySelectorAll(".payment-option-card").forEach((card) => {
    const input = card.querySelector(`input[name="${inputName}"]`);
    card.classList.toggle("is-selected", Boolean(input?.checked));
  });
}

function syncPaymentModeUi() {
  const form = document.getElementById("checkout-form");
  const paymentModeContainer = document.getElementById("payment-methods");
  const transferPicker = document.getElementById("transfer-account-picker");
  if (!form || !paymentModeContainer || !transferPicker) {
    return;
  }

  const isTransfer = selectedCheckoutMode(form) === "transfer";
  syncSelectionCards(paymentModeContainer, "payment_mode");
  syncSelectionCards(transferPicker, "transfer_account");
  transferPicker.classList.toggle("hidden", !isTransfer);
  transferPicker.querySelectorAll('input[name="transfer_account"]').forEach((input) => {
    input.disabled = !isTransfer;
  });
}

function renderPaymentOptions() {
  const target = document.getElementById("payment-methods");
  const transferPicker = document.getElementById("transfer-account-picker");
  if (!target || !transferPicker) {
    return;
  }

  const availableTransfers = transferOptions();
  const hasTransfers = availableTransfers.length > 0;
  const initialTransfer = availableTransfers[0];

  target.innerHTML = `
    ${
      hasTransfers
        ? `
          <label class="payment-option-card is-selected">
            <input name="payment_mode" type="radio" value="transfer" checked>
            <span class="payment-option-icon">
              <i class="fa-solid fa-building-columns" aria-hidden="true"></i>
            </span>
            <span class="payment-option-copy">
              <strong>Transfer</strong>
              <small>Place the order first, then transfer from your banking app and use the bank account you choose below.</small>
            </span>
          </label>
        `
        : ""
    }
    <label class="payment-option-card ${hasTransfers ? "" : "is-selected"}">
      <input name="payment_mode" type="radio" value="pay_on_delivery" ${hasTransfers ? "" : "checked"}>
      <span class="payment-option-icon">
        <i class="fa-solid fa-truck-fast" aria-hidden="true"></i>
      </span>
      <span class="payment-option-copy">
        <strong>Pay on delivery</strong>
        <small>Reserve the order and pay when Hoinam Energy confirms delivery.</small>
      </span>
    </label>
  `;

  if (hasTransfers) {
    transferPicker.innerHTML = `
      <div class="transfer-account-picker-head">
        <strong>Available bank accounts</strong>
        <p>Select the bank/account you want to pay into from your mobile banking app.</p>
      </div>
      <div class="transfer-account-list">
        ${availableTransfers
          .map((option, index) => transferCardMarkup(option, index === 0 && option.id === initialTransfer?.id))
          .join("")}
      </div>
    `;
  } else {
    transferPicker.innerHTML = "";
  }

  target.querySelectorAll('input[name="payment_mode"]').forEach((input) => {
    input.addEventListener("change", syncPaymentModeUi);
  });
  transferPicker.querySelectorAll('input[name="transfer_account"]').forEach((input) => {
    input.addEventListener("change", syncPaymentModeUi);
  });

  syncPaymentModeUi();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatReceiptDate(value) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function buildReceiptDocument(order) {
  const paymentDetails = paymentDetailsForOrder(order);
  const shipping = order.shipping_address || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const notes = order.notes?.trim() || "None";
  const total = formatMoney(order.total_amount, order.currency);
  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name || "Product")}</td>
          <td>${escapeHtml(item.quantity || 0)}</td>
          <td>${escapeHtml(formatMoney(item.unit_price || 0, item.currency || order.currency))}</td>
          <td>${escapeHtml(formatMoney(item.line_total || 0, item.currency || order.currency))}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt ${escapeHtml(order.order_number)}</title>
        <style>
          :root {
            color-scheme: light;
            --ink: #11233a;
            --soft: #5e6f85;
            --line: #d7e0ea;
            --brand: #0055b8;
            --panel: #f6f9fc;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 32px;
            font-family: "Segoe UI", Arial, sans-serif;
            color: var(--ink);
            background: #ffffff;
          }
          .receipt-shell {
            max-width: 860px;
            margin: 0 auto;
            border: 1px solid var(--line);
            border-radius: 20px;
            overflow: hidden;
          }
          .receipt-head {
            padding: 28px 32px;
            background: linear-gradient(135deg, #0055b8, #0b79de);
            color: #ffffff;
          }
          .receipt-head h1,
          .receipt-head p,
          .receipt-body h2,
          .receipt-body p {
            margin: 0;
          }
          .receipt-head h1 {
            font-size: 1.8rem;
            margin-bottom: 0.35rem;
          }
          .receipt-body {
            padding: 28px 32px 32px;
            display: grid;
            gap: 24px;
          }
          .receipt-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }
          .receipt-card {
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 18px;
            background: var(--panel);
          }
          .receipt-card h2 {
            font-size: 1rem;
            margin-bottom: 0.7rem;
          }
          .receipt-meta {
            display: grid;
            gap: 0.6rem;
          }
          .receipt-meta strong,
          .receipt-card strong {
            display: block;
            font-size: 0.76rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--soft);
            margin-bottom: 0.14rem;
          }
          .receipt-meta span,
          .receipt-card p {
            display: block;
            line-height: 1.5;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th,
          td {
            padding: 12px 10px;
            border-bottom: 1px solid var(--line);
            text-align: left;
            font-size: 0.95rem;
          }
          th {
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--soft);
          }
          .receipt-total {
            display: flex;
            justify-content: flex-end;
            font-size: 1.05rem;
            font-weight: 700;
          }
          .receipt-footer {
            color: var(--soft);
            font-size: 0.92rem;
          }
          @media print {
            body {
              padding: 0;
            }
            .receipt-shell {
              border: 0;
              border-radius: 0;
            }
          }
          @media (max-width: 720px) {
            body {
              padding: 14px;
            }
            .receipt-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <article class="receipt-shell">
          <header class="receipt-head">
            <h1>Hoinam Energy Receipt</h1>
            <p>Order ${escapeHtml(order.order_number)} created on ${escapeHtml(formatReceiptDate(order.created_at))}</p>
          </header>
          <section class="receipt-body">
            <div class="receipt-grid">
              <section class="receipt-card">
                <h2>Customer</h2>
                <div class="receipt-meta">
                  <div>
                    <strong>Name</strong>
                    <span>${escapeHtml(shipping.full_name || "Not provided")}</span>
                  </div>
                  <div>
                    <strong>Phone</strong>
                    <span>${escapeHtml(shipping.phone || "Not provided")}</span>
                  </div>
                  <div>
                    <strong>Address</strong>
                    <span>${escapeHtml([shipping.address, shipping.city, shipping.state].filter(Boolean).join(", ") || "Not provided")}</span>
                  </div>
                </div>
              </section>
              <section class="receipt-card">
                <h2>Payment</h2>
                <div class="receipt-meta">
                  <div>
                    <strong>Method</strong>
                    <span>${escapeHtml(paymentDetails.label)}</span>
                  </div>
                  <div>
                    <strong>Reference</strong>
                    <span>${escapeHtml(order.payment_reference)}</span>
                  </div>
                  ${
                    paymentDetails.kind === "transfer"
                      ? `
                        <div>
                          <strong>Bank</strong>
                          <span>${escapeHtml(paymentDetails.bank_name || "Pending setup")}</span>
                        </div>
                        <div>
                          <strong>Account number</strong>
                          <span>${escapeHtml(paymentDetails.account_number || "Pending setup")}</span>
                        </div>
                        <div>
                          <strong>Account name</strong>
                          <span>${escapeHtml(paymentDetails.account_name || "Hoinam Energy")}</span>
                        </div>
                      `
                      : ""
                  }
                  ${order.verification_code ? `<div><strong>Verification code</strong><span>${escapeHtml(order.verification_code)}</span></div>` : ""}
                </div>
              </section>
            </div>
            <section class="receipt-card">
              <h2>Order items</h2>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>
              <div class="receipt-total">Total: ${escapeHtml(total)}</div>
            </section>
            <section class="receipt-card">
              <h2>Notes</h2>
              <p>${escapeHtml(notes)}</p>
            </section>
            <p class="receipt-footer">This receipt was generated from the Hoinam Energy checkout page. You can print it or save it as PDF from your browser.</p>
          </section>
        </article>
      </body>
    </html>
  `;
}

function downloadReceipt(order) {
  const documentHtml = buildReceiptDocument(order);
  const blob = new Blob([documentHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `receipt-${order.order_number}.html`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function printReceipt(order) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    showToast("Allow pop-ups in your browser so the receipt can open for printing.", "error");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildReceiptDocument(order));
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
}

function bindReceiptActions(order) {
  document.querySelector("[data-print-receipt]")?.addEventListener("click", () => {
    printReceipt(order);
  });
  document.querySelector("[data-download-receipt]")?.addEventListener("click", () => {
    downloadReceipt(order);
  });
}

function renderOrderComplete(order) {
  const status = document.getElementById("checkout-status");
  const paymentDetails = paymentDetailsForOrder(order);
  const isTransfer = paymentDetails.kind === "transfer";

  status.innerHTML = `
    <div class="panel checkout-complete-panel">
      <span class="badge">${isTransfer ? "Transfer pending" : "Pay on delivery"}</span>
      <h3>Order ${order.order_number} created</h3>
      <p class="muted">
        ${isTransfer
          ? "Transfer to the selected bank account below and keep your receipt. You can print or download the order receipt right away."
          : "Hoinam Energy will contact you to confirm delivery and collect payment. You can still print or download your order receipt now."}
      </p>
      ${
        isTransfer
          ? `
            <div class="transfer-details">
              <div><span>Bank</span><strong>${paymentDetails.bank_name || "Pending setup"}</strong></div>
              <div><span>Account number</span><strong>${paymentDetails.account_number || "Pending setup"}</strong></div>
              <div><span>Account name</span><strong>${paymentDetails.account_name || "Hoinam Energy"}</strong></div>
              <div><span>Reference</span><strong>${order.payment_reference}</strong></div>
              ${order.verification_code ? `<div><span>Verification code</span><strong>${order.verification_code}</strong></div>` : ""}
              <div><span>Order date</span><strong>${formatDate(order.created_at)}</strong></div>
            </div>
          `
          : `<p class="checkout-reference">Reference: <strong>${order.payment_reference}</strong></p>`
      }
      <div class="receipt-actions">
        <button class="button" type="button" data-print-receipt><i class="fa-solid fa-print" aria-hidden="true"></i> Print receipt</button>
        <button class="button button-ghost" type="button" data-download-receipt><i class="fa-solid fa-download" aria-hidden="true"></i> Download receipt</button>
      </div>
      <p class="receipt-note">Use Print to save as PDF, or Download to keep an HTML copy on the device.</p>
      <div class="inline-actions">
        <a class="button" href="/dashboard.html">View dashboard</a>
        <a class="button button-ghost" href="/products.html">Continue shopping</a>
      </div>
    </div>
  `;

  bindReceiptActions(order);
  window.scrollTo({ top: 0, behavior: "smooth" });
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
