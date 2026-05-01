import { createOrder, getPaymentOptions, uploadPaymentReceipt, validateCoupon } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { clearCart, getCart, getCartSubtotal } from "../store.js";
import { formatDate, formatMoney, showToast } from "../ui.js";

let paymentOptions = [];
let appliedCoupon = null; // { code, discount_amount, final_total, description, discount_type, discount_value }

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
    summary.innerHTML = `<div class="empty-state">Your cart is empty. Add products before checkout.</div>`;
    return;
  }

  const subtotal = getCartSubtotal();
  const discountAmount = appliedCoupon?.discount_amount || 0;
  const finalTotal = appliedCoupon ? appliedCoupon.final_total : subtotal;

  summary.innerHTML = `
    <div class="panel checkout-summary-panel">
      <h3>Order summary</h3>
      <div class="summary-list">
        ${cart.map((item) => `
          <div class="summary-row">
            <span>${item.name} x ${item.quantity}</span>
            <strong>${formatMoney(item.price * item.quantity, item.currency)}</strong>
          </div>
        `).join("")}
        <div class="summary-row">
          <span>Subtotal</span>
          <strong>${formatMoney(subtotal)}</strong>
        </div>
        ${appliedCoupon ? `
          <div class="summary-row summary-row-discount">
            <span><i class="fa-solid fa-tag" aria-hidden="true"></i> Coupon <strong>${appliedCoupon.code}</strong>
              (${appliedCoupon.discount_type === "percent" ? `${appliedCoupon.discount_value}% off` : `${formatMoney(appliedCoupon.discount_value)} off`})
            </span>
            <strong class="discount-amount">−${formatMoney(discountAmount)}</strong>
          </div>
          <div class="summary-row summary-row-total">
            <span>Total</span>
            <strong class="price">${formatMoney(finalTotal)}</strong>
          </div>
        ` : `
          <div class="summary-row">
            <span>Total</span>
            <strong class="price">${formatMoney(subtotal)}</strong>
          </div>
        `}
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
  const unavailableMethods = paymentOptions.filter((o) => o._unavailable);

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
              <strong>Transfer before delivery</strong>
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
    ${unavailableMethods
      .map(
        (opt) => `
      <div class="payment-option-card payment-option-card--unavailable" aria-disabled="true">
        <span class="payment-option-icon">
          <i class="fa-solid fa-wrench" aria-hidden="true"></i>
        </span>
        <span class="payment-option-copy">
          <strong><s>${opt.label}</s></strong>
          <small class="payment-option-maintenance"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${opt.reason || "Currently under maintenance"}</small>
        </span>
      </div>
    `
      )
      .join("")}
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

function showStockErrorModal({ productName, requested, available, discountCode }) {
  // Remove any existing modal
  document.getElementById("stock-error-modal")?.remove();

  const modal = document.createElement("div");
  modal.id = "stock-error-modal";
  modal.className = "stock-modal-overlay";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "stock-modal-title");

  modal.innerHTML = `
    <div class="stock-modal-card">
      <div class="stock-modal-icon">
        <i class="fa-solid fa-box-open" aria-hidden="true"></i>
      </div>
      <h2 id="stock-modal-title">Not enough stock</h2>
      <p>
        Sorry — we only have <strong>${available} unit${available !== 1 ? "s" : ""}</strong> of
        <strong>${escapeHtml(productName)}</strong> available right now.
        You requested <strong>${requested}</strong>.
      </p>
      <p class="stock-modal-advice">
        Please update your cart to the available quantity and try again.
        New stock arrives weekly — check back next week for more.
      </p>
      <div class="stock-modal-discount">
        <i class="fa-solid fa-tag" aria-hidden="true"></i>
        <div>
          <strong>Sorry for the inconvenience — here's a 2% discount on your next order:</strong>
          <div class="stock-modal-code" id="stock-modal-code-text">${escapeHtml(discountCode || "SORRY2")}</div>
          <button class="stock-modal-copy-btn" type="button" id="stock-modal-copy-btn">
            <i class="fa-regular fa-copy" aria-hidden="true"></i> Copy code
          </button>
        </div>
      </div>
      <div class="stock-modal-actions">
        <a class="button" href="/cart.html">
          <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i> Update cart
        </a>
        <button class="button button-ghost" type="button" id="stock-modal-close">
          Close
        </button>
      </div>
    </div>
  `;

  document.body.append(modal);

  // Copy discount code
  document.getElementById("stock-modal-copy-btn")?.addEventListener("click", () => {
    const code = document.getElementById("stock-modal-code-text")?.textContent || "";
    navigator.clipboard?.writeText(code).then(() => {
      const btn = document.getElementById("stock-modal-copy-btn");
      if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i> Copied!`;
        window.setTimeout(() => {
          btn.innerHTML = `<i class="fa-regular fa-copy" aria-hidden="true"></i> Copy code`;
        }, 2000);
      }
    });
  });

  // Close on button or backdrop click
  const close = () => modal.remove();
  document.getElementById("stock-modal-close")?.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
  });
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

// ── Receipt as PNG ────────────────────────────────────────────────────────────
// Replaces the old popup-based print approach with a canvas render → PNG download.
// html2canvas is loaded on demand from CDN so it doesn't affect page load time.

function loadHtml2Canvas() {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) { resolve(window.html2canvas); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    script.onload = () => resolve(window.html2canvas);
    script.onerror = () => reject(new Error("Could not load image renderer. Check your internet connection."));
    document.head.append(script);
  });
}

function buildReceiptNode(order) {
  const paymentDetails = paymentDetailsForOrder(order);
  const shipping = order.shipping_address || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const notes = order.notes?.trim() || "None";
  const total = formatMoney(order.total_amount, order.currency);

  const node = document.createElement("div");
  node.style.cssText = [
    "position:fixed", "left:-9999px", "top:0",
    "width:860px", "background:#fff",
    "font-family:Segoe UI,Arial,sans-serif",
    "color:#11233a", "font-size:15px", "line-height:1.5",
    "box-sizing:border-box"
  ].join(";");

  const transferRows = paymentDetails.kind === "transfer" ? `
    <div style="margin-top:8px">
      <span style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85;display:block">Bank</span>
      <span>${escapeHtml(paymentDetails.bank_name || "Pending setup")}</span>
    </div>
    <div style="margin-top:8px">
      <span style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85;display:block">Account number</span>
      <span>${escapeHtml(paymentDetails.account_number || "Pending setup")}</span>
    </div>
    <div style="margin-top:8px">
      <span style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85;display:block">Account name</span>
      <span>${escapeHtml(paymentDetails.account_name || "Hoinam Energy")}</span>
    </div>
  ` : "";

  const verificationRow = order.verification_code ? `
    <div style="margin-top:8px">
      <span style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85;display:block">Verification code</span>
      <span>${escapeHtml(order.verification_code)}</span>
    </div>
  ` : "";

  const itemRows = items.map((item) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #d7e0ea">${escapeHtml(item.name || "Product")}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #d7e0ea">${escapeHtml(String(item.quantity || 0))}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #d7e0ea">${escapeHtml(formatMoney(item.unit_price || 0, item.currency || order.currency))}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #d7e0ea">${escapeHtml(formatMoney(item.line_total || 0, item.currency || order.currency))}</td>
    </tr>
  `).join("");

  node.innerHTML = `
    <div style="border:1px solid #d7e0ea;border-radius:20px;overflow:hidden;max-width:860px;margin:0 auto">
      <!-- Header -->
      <div style="padding:28px 32px;background:linear-gradient(135deg,#0055b8,#0b79de);color:#fff">
        <div style="font-size:28px;font-weight:800;margin-bottom:6px">Hoinam Energy Receipt</div>
        <div style="font-size:14px;opacity:.9">Order ${escapeHtml(order.order_number)} · ${escapeHtml(formatReceiptDate(order.created_at))}</div>
      </div>
      <!-- Body -->
      <div style="padding:28px 32px;background:#fff">
        <!-- Customer + Payment grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <!-- Customer -->
          <div style="border:1px solid #d7e0ea;border-radius:14px;padding:18px;background:#f6f9fc">
            <div style="font-size:14px;font-weight:700;margin-bottom:12px">Customer</div>
            <div>
              <span style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85;display:block">Name</span>
              <span>${escapeHtml(shipping.full_name || "Not provided")}</span>
            </div>
            <div style="margin-top:8px">
              <span style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85;display:block">Phone</span>
              <span>${escapeHtml(shipping.phone || "Not provided")}</span>
            </div>
            <div style="margin-top:8px">
              <span style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85;display:block">Address</span>
              <span>${escapeHtml([shipping.address, shipping.city, shipping.state].filter(Boolean).join(", ") || "Not provided")}</span>
            </div>
          </div>
          <!-- Payment -->
          <div style="border:1px solid #d7e0ea;border-radius:14px;padding:18px;background:#f6f9fc">
            <div style="font-size:14px;font-weight:700;margin-bottom:12px">Payment</div>
            <div>
              <span style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85;display:block">Method</span>
              <span>${escapeHtml(paymentDetails.label)}</span>
            </div>
            <div style="margin-top:8px">
              <span style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85;display:block">Reference</span>
              <span>${escapeHtml(order.payment_reference)}</span>
            </div>
            ${transferRows}
            ${verificationRow}
          </div>
        </div>
        <!-- Items table -->
        <div style="border:1px solid #d7e0ea;border-radius:14px;padding:18px;background:#f6f9fc;margin-bottom:16px">
          <div style="font-size:14px;font-weight:700;margin-bottom:12px">Order items</div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="padding:10px 8px;border-bottom:2px solid #d7e0ea;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85">Item</th>
                <th style="padding:10px 8px;border-bottom:2px solid #d7e0ea;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85">Qty</th>
                <th style="padding:10px 8px;border-bottom:2px solid #d7e0ea;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85">Unit price</th>
                <th style="padding:10px 8px;border-bottom:2px solid #d7e0ea;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#5e6f85">Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="text-align:right;font-size:16px;font-weight:700;padding-top:12px">Total: ${escapeHtml(total)}</div>
        </div>
        <!-- Notes -->
        <div style="border:1px solid #d7e0ea;border-radius:14px;padding:18px;background:#f6f9fc;margin-bottom:16px">
          <div style="font-size:14px;font-weight:700;margin-bottom:8px">Notes</div>
          <div>${escapeHtml(notes)}</div>
        </div>
        <div style="font-size:12px;color:#5e6f85">This receipt was generated by Hoinam Energy. Save this image for your records.</div>
      </div>
    </div>
  `;

  document.body.append(node);
  return node;
}

async function downloadReceiptPng(order, btn) {
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Generating…`;

  let node = null;
  try {
    const html2canvas = await loadHtml2Canvas();
    node = buildReceiptNode(order);

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: 860,
    });

    const link = document.createElement("a");
    link.download = `receipt-${order.order_number}.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.append(link);
    link.click();
    link.remove();

    showToast("Receipt saved as PNG.", "success");
  } catch (error) {
    showToast(error.message || "Could not generate receipt image.", "error");
  } finally {
    node?.remove();
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function bindReceiptActions(order) {
  const printBtn = document.querySelector("[data-print-receipt]");
  const downloadBtn = document.querySelector("[data-download-receipt]");

  // Both buttons now save as PNG — no popup needed
  printBtn?.addEventListener("click", () => downloadReceiptPng(order, printBtn));
  downloadBtn?.addEventListener("click", () => downloadReceiptPng(order, downloadBtn));
}

function renderOrderComplete(order) {
  const status = document.getElementById("checkout-status");
  const paymentDetails = paymentDetailsForOrder(order);
  const isTransfer = paymentDetails.kind === "transfer";
  const verificationCode = order.verification_code || "";

  status.innerHTML = `
    <div class="panel checkout-complete-panel">
      <span class="badge">${isTransfer ? "Transfer pending" : "Pay on delivery"}</span>
      <h3>Order ${order.order_number} created</h3>
      <p class="muted">
        ${isTransfer
          ? "Transfer to the bank account below, then upload your payment screenshot or receipt. Hoinam Energy will verify and approve your order within 40 minutes."
          : "Hoinam Energy will contact you to confirm delivery and collect payment. You can still print or download your order receipt now."}
      </p>
      ${
        isTransfer
          ? `
            <div class="transfer-details">
              <div><span>Bank</span><strong>${paymentDetails.bank_name || "Pending setup"}</strong></div>
              <div><span>Account number</span><strong>${paymentDetails.account_number || "Pending setup"}</strong></div>
              <div><span>Account name</span><strong>${paymentDetails.account_name || "Hoinam Energy"}</strong></div>
              <div><span>Reference / Narration</span><strong>${order.payment_reference}</strong></div>
              ${verificationCode ? `<div><span>Verification code</span><strong>${verificationCode}</strong></div>` : ""}
              <div><span>Order date</span><strong>${formatDate(order.created_at)}</strong></div>
            </div>
            <div class="proof-upload-box" id="proof-upload-box">
              <h4><i class="fa-solid fa-image" aria-hidden="true"></i> Upload proof of payment</h4>
              <p class="muted">Take a screenshot of your transfer confirmation and upload it here. We'll verify and approve your order within 40 minutes.</p>
              <label class="proof-upload-label" id="proof-upload-label">
                <input type="file" id="proof-file-input" accept="image/png,image/jpeg,image/jpg,image/gif,application/pdf" style="display:none">
                <span class="proof-upload-placeholder" id="proof-upload-placeholder">
                  <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
                  <span>Click to choose a file (PNG, JPG, PDF)</span>
                </span>
              </label>
              <div id="proof-upload-preview" class="proof-upload-preview hidden"></div>
              <button class="button" type="button" id="proof-upload-btn" disabled>
                <i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Submit proof of payment
              </button>
              <p class="proof-upload-status hidden" id="proof-upload-status"></p>
            </div>
          `
          : `<p class="checkout-reference">Reference: <strong>${order.payment_reference}</strong></p>`
      }
      <div class="receipt-actions">
        <button class="button" type="button" data-print-receipt><i class="fa-solid fa-image" aria-hidden="true"></i> Save receipt as PNG</button>
        <button class="button button-ghost" type="button" data-download-receipt><i class="fa-solid fa-download" aria-hidden="true"></i> Download PNG</button>
      </div>
      <p class="receipt-note">Both buttons save the receipt as a PNG image you can keep on your device or share.</p>
      <div class="inline-actions">
        <a class="button" href="/dashboard.html">View dashboard</a>
        <a class="button button-ghost" href="/products.html">Continue shopping</a>
      </div>
    </div>
  `;

  bindReceiptActions(order);

  // Wire up proof-of-payment upload if transfer order
  if (isTransfer && verificationCode) {
    const fileInput = document.getElementById("proof-file-input");
    const uploadBtn = document.getElementById("proof-upload-btn");
    const preview = document.getElementById("proof-upload-preview");
    const statusEl = document.getElementById("proof-upload-status");
    const placeholder = document.getElementById("proof-upload-placeholder");

    fileInput?.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      uploadBtn.disabled = false;
      placeholder.innerHTML = `<i class="fa-solid fa-file-circle-check" aria-hidden="true"></i> <span>${file.name}</span>`;
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.innerHTML = `<img src="${e.target.result}" alt="Payment proof preview">`;
          preview.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      } else {
        preview.innerHTML = `<p class="muted"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> ${file.name}</p>`;
        preview.classList.remove("hidden");
      }
    });

    uploadBtn?.addEventListener("click", async () => {
      const file = fileInput?.files?.[0];
      if (!file) return;

      uploadBtn.disabled = true;
      uploadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Uploading…`;
      statusEl.classList.remove("hidden");
      statusEl.className = "proof-upload-status";
      statusEl.textContent = "Uploading your proof of payment…";

      try {
        await uploadPaymentReceipt(verificationCode, file);
        statusEl.className = "proof-upload-status proof-upload-success";
        statusEl.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Uploaded! Hoinam Energy will verify and approve your order within 40 minutes. You'll receive a confirmation email once approved.`;
        uploadBtn.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Submitted`;
        document.getElementById("proof-upload-box").classList.add("proof-upload-done");
      } catch (error) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = `<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Submit proof of payment`;
        statusEl.className = "proof-upload-status proof-upload-error";
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${error.message}`;
        showToast(error.message, "error");
      }
    });
  }

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
    // Tag unavailable methods so the UI can render them as disabled/strikethrough
    const unavailable = (optionsPayload.unavailable || []).map((opt) => ({ ...opt, _unavailable: true }));
    paymentOptions = [...paymentOptions, ...unavailable];
    renderPaymentOptions();
  } catch (error) {
    showToast(error.message, "error");
  }

  form.full_name.value = profile.full_name || "";
  form.phone.value = profile.phone || "";

  // Coupon apply button
  document.getElementById("apply-coupon-btn")?.addEventListener("click", async () => {
    const code = (form.coupon_code.value || "").trim().toUpperCase();
    const statusEl = document.getElementById("coupon-status");
    const btn = document.getElementById("apply-coupon-btn");

    if (!code) { showToast("Enter a coupon code first.", "error"); return; }

    btn.disabled = true;
    btn.textContent = "Checking…";

    try {
      const result = await validateCoupon(code, getCartSubtotal());
      appliedCoupon = { ...result, code };
      form.coupon_code.value = code;
      statusEl.className = "coupon-status coupon-valid";
      statusEl.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> <strong>${code}</strong> applied — ${result.discount_type === "percent" ? `${result.discount_value}% off` : formatMoney(result.discount_value) + " off"}. You save ${formatMoney(result.discount_amount)}.`;
      statusEl.classList.remove("hidden");
      btn.textContent = "Applied ✓";
      renderSummary();
    } catch (error) {
      appliedCoupon = null;
      statusEl.className = "coupon-status coupon-invalid";
      statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${error.message}`;
      statusEl.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Apply";
      renderSummary();
    }
  });

  // Clear coupon if code is manually changed
  form.coupon_code.addEventListener("input", () => {
    if (appliedCoupon) {
      appliedCoupon = null;
      const statusEl = document.getElementById("coupon-status");
      statusEl.classList.add("hidden");
      const btn = document.getElementById("apply-coupon-btn");
      btn.disabled = false;
      btn.textContent = "Apply";
      renderSummary();
    }
  });

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
        payment_method: selectedPaymentMethod(form),
        coupon_code: appliedCoupon?.code || null
      });

      clearCart();
      form.classList.add("hidden");
      renderOrderComplete(order);
      showToast("Order created successfully.", "success");
    } catch (error) {
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = false;
      submitButton.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Place order`;

      if (error.errorType === "stock_error") {
        showStockErrorModal({
          productName: error.errorData.product_name,
          requested: error.errorData.requested,
          available: error.errorData.available,
          discountCode: error.errorData.discount_code,
        });
      } else {
        showToast(error.message, "error");
      }
    }
  });
}

init();
