import { getUserInstallations, getUserOrders, updateProfile } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { formatDate, formatMoney, showToast, statusBadge } from "../ui.js";

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

function renderPhoneCompletion(profile) {
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
  const profile = await bootstrapPage("dashboard", { requireAuth: true });
  if (!profile) {
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
          .map(
            (order) => `
              <article class="order-card">
                <div class="chip-row">
                  <span class="badge">${order.order_number}</span>
                  ${statusBadge(order.status)}
                </div>
                <h3>${formatMoney(order.total_amount, order.currency)}</h3>
                <p class="muted">Paid via reference ${order.payment_reference}</p>
                <div class="mini-meta">
                  <span>${formatDate(order.created_at)}</span>
                  <span>${order.items.length} item(s)</span>
                </div>
              </article>
            `
          )
          .join("")
      : `<div class="empty-state">No orders yet. Your purchases will appear here after checkout.</div>`;

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
  }
}

init();
