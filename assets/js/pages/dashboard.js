import { getUserInstallations, getUserOrders, updateProfile, uploadPaymentReceipt } from "../api.js";
import authLoadingManager from "../auth-loading.js";
import { bootstrapPage } from "../app-shell.js";
import { formatDate, formatMoney, showToast, statusBadge } from "../ui.js";

function paymentLabel(order) {
  if (order.payment_details?.label) {
    return order.payment_details.label;
  }
  if (order.payment_method === "pay_on_delivery") {
    return "Pay on delivery";
  }
  if (order.payment_method === "bank_transfer") {
    return "Bank transfer";
  }
  return "OPay merchant transfer";
}

function normalizePhoneNumber(rawValue) {
  const value = rawValue.trim().replace(/[^\d+]/g, "");
  if (!value) {
    throw new Error("Enter your phone number first.");
  }
  if (value.startsWith("+")) {
    return value;
  }
  if (value.startsWith("0")) {
    return `+234${value.slice(1)}`;
  }
  if (value.startsWith("234")) {
    return `+${value}`;
  }
  throw new Error("Enter a valid phone number like +2348012345678 or 08012345678.");
}

function renderOrderCard(order) {
  const isPendingTransfer = (
    order.payment_method === "bank_transfer" &&
    (order.payment_status === "awaiting_transfer" || order.payment_status === "receipt_uploaded")
  );
  const verificationCode = order.payment_details?.verification_code || "";
  const receiptUploaded = order.payment_status === "receipt_uploaded";

  return `
    <article class="order-card" data-order-id="${order.id}">
      <div class="chip-row">
        <span class="badge">${order.order_number}</span>
        ${statusBadge(order.status)}
      </div>
      <h3>${formatMoney(order.total_amount, order.currency)}</h3>
      <p class="muted">${paymentLabel(order)} — ${order.payment_reference}</p>
      <div class="mini-meta">
        <span>${formatDate(order.created_at)}</span>
        <span>${order.items.length} item(s)</span>
      </div>
      ${isPendingTransfer ? `
        <div class="order-upload-section ${receiptUploaded ? "order-upload-done" : ""}" id="upload-section-${order.id}">
          ${receiptUploaded
            ? `<p class="order-upload-pending"><i class="fa-solid fa-clock" aria-hidden="true"></i> Proof of payment submitted — awaiting verification (up to 40 min).</p>`
            : `
              <p class="order-upload-prompt"><i class="fa-solid fa-image" aria-hidden="true"></i> Upload your transfer screenshot to speed up approval.</p>
              <label class="proof-upload-label">
                <input type="file" class="order-proof-input" data-order-id="${order.id}" data-code="${verificationCode}" accept="image/png,image/jpeg,image/jpg,image/gif,application/pdf" style="display:none">
                <span class="proof-upload-placeholder">
                  <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
                  <span>Choose file</span>
                </span>
              </label>
              <button class="button button-sm order-proof-submit" data-order-id="${order.id}" data-code="${verificationCode}" disabled>
                <i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Submit proof
              </button>
              <p class="proof-upload-status hidden" id="upload-status-${order.id}"></p>
            `
          }
        </div>
      ` : ""}
    </article>
  `;
}

function bindOrderUploadHandlers() {
  document.querySelectorAll(".order-proof-input").forEach((input) => {
    input.addEventListener("change", () => {
      const orderId = input.dataset.orderId;
      const btn = document.querySelector(`.order-proof-submit[data-order-id="${orderId}"]`);
      const placeholder = input.closest(".proof-upload-label")?.querySelector(".proof-upload-placeholder span:last-child");
      if (input.files?.[0]) {
        if (btn) btn.disabled = false;
        if (placeholder) placeholder.textContent = input.files[0].name;
      }
    });
  });

  document.querySelectorAll(".order-proof-submit").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = btn.dataset.orderId;
      const code = btn.dataset.code;
      const input = document.querySelector(`.order-proof-input[data-order-id="${orderId}"]`);
      const statusEl = document.getElementById(`upload-status-${orderId}`);
      const file = input?.files?.[0];
      if (!file || !code) return;

      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Uploading…`;
      if (statusEl) { statusEl.className = "proof-upload-status"; statusEl.textContent = "Uploading…"; statusEl.classList.remove("hidden"); }

      try {
        await uploadPaymentReceipt(code, file);
        const section = document.getElementById(`upload-section-${orderId}`);
        if (section) {
          section.classList.add("order-upload-done");
          section.innerHTML = `<p class="order-upload-pending"><i class="fa-solid fa-clock" aria-hidden="true"></i> Proof submitted — awaiting verification (up to 40 min).</p>`;
        }
        showToast("Proof of payment submitted.", "success");
      } catch (error) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Submit proof`;
        if (statusEl) { statusEl.className = "proof-upload-status proof-upload-error"; statusEl.textContent = error.message; }
        showToast(error.message, "error");
      }
    });
  });
}
  const target = document.getElementById("profile-completion-slot");
  if (!target) {
    return;
  }

  if (profile?.phone) {
    target.innerHTML = "";
    return;
  }

  target.innerHTML = `
    <article class="panel profile-completion-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Complete your profile</span>
          <h2><i class="fa-solid fa-phone-volume" aria-hidden="true"></i> Add your phone number</h2>
        </div>
      </div>
      <p class="panel-copy">
        Your dashboard is ready. Add a reachable phone number so Hoinam Energy can confirm orders,
        installation visits, and support follow-ups.
      </p>
      <form class="form-grid" id="profile-phone-form">
        <div class="field">
          <label for="profile-phone">Phone number</label>
          <input
            id="profile-phone"
            name="phone"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            placeholder="+2348012345678 or 08012345678"
            required
          >
        </div>
        <div class="field profile-completion-actions">
          <label>&nbsp;</label>
          <button class="btn btn-primary" type="submit">
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            Save phone number
          </button>
        </div>
      </form>
    </article>
  `;

  const form = document.getElementById("profile-phone-form");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const phone = normalizePhoneNumber(form.phone.value);
      const updatedProfile = await updateProfile({ phone });
      renderPhoneCompletion(updatedProfile);
      showToast("Phone number saved.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

async function init() {
  const profile = await bootstrapPage("dashboard", {
    requireAuth: true,
    preserveAuthLoading: true
  });
  if (!profile) {
    authLoadingManager.hide();
    return;
  }

  document.getElementById("profile-name").textContent = profile.full_name || "Customer";
  document.getElementById("profile-email").textContent = profile.email || "Signed in user";
  renderPhoneCompletion(profile);

  try {
    const [orders, installations] = await Promise.all([getUserOrders(), getUserInstallations()]);

    document.getElementById("dashboard-stats").innerHTML = `
      <article class="stat-card">
        <span>Total orders</span>
        <strong>${orders.length}</strong>
      </article>
      <article class="stat-card">
        <span>Installations booked</span>
        <strong>${installations.length}</strong>
      </article>
      <article class="stat-card">
        <span>Most recent order</span>
        <strong>${orders[0]?.order_number || "None yet"}</strong>
      </article>
    `;

    document.getElementById("orders-list").innerHTML = orders.length
      ? orders
          .map((order) => renderOrderCard(order))
          .join("")
      : `<div class="empty-state">No orders yet. Your purchases will appear here after checkout.</div>`;

    bindOrderUploadHandlers();

    document.getElementById("installations-list").innerHTML = installations.length
      ? installations
          .map(
            (item) => `
              <article class="installation-card">
                <div class="chip-row">
                  <span class="badge">${item.service_type}</span>
                  ${statusBadge(item.status)}
                </div>
                <h3>${item.product?.name || "General installation request"}</h3>
                <p class="muted">${item.address}</p>
                <div class="mini-meta">
                  <span>${formatDate(item.preferred_date || item.created_at)}</span>
                  <span>${item.assigned_to || "Assignment pending"}</span>
                </div>
              </article>
            `
          )
          .join("")
      : `<div class="empty-state">No installation requests yet. Book your setup when you're ready.</div>`;
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    authLoadingManager.hide();
  }
}

init();
