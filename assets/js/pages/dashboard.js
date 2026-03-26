import { getUserInstallations, getUserOrders } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { formatDate, formatMoney, showToast, statusBadge } from "../ui.js";

async function init() {
  const profile = await bootstrapPage("dashboard", { requireAuth: true });
  if (!profile) {
    return;
  }

  document.getElementById("profile-name").textContent = profile.full_name || "Customer";
  document.getElementById("profile-email").textContent = profile.email || "Signed in user";

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
