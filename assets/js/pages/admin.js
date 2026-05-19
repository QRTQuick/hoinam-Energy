import {
  archiveProduct,
  createProduct,
  getAdminInstallations,
  getAdminOrders,
  getAdminStats,
  getAdminUsers,
  getAdminJobs,
  getAdminFeedback,
  getAdminCoupons,
  createJob,
  createCoupon,
  updateJob,
  updateCoupon,
  deleteJob,
  deleteCoupon,
  getSeason,
  setSeason,
  listProducts,
  updateInstallationAdmin,
  updateProduct,
  uploadInventory,
  getPendingDeliveries,
  confirmDelivery
} from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { SEASON_META, applySeason } from "../app-shell.js";
import { formatDate, formatMoney, productMedia, showToast, statusBadge } from "../ui.js";

let products = [];
let installations = [];
let jobs = [];
const MAX_PRODUCT_IMAGE_BYTES = 1.5 * 1024 * 1024;

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

function field(form, name) {
  return form.elements.namedItem(name);
}

function setProductImagePreview(form, imageUrl = field(form, "image_url").value.trim()) {
  const previewImage = document.getElementById("product-image-preview-image");
  const previewPlaceholder = document.getElementById("product-image-preview-placeholder");
  if (!previewImage || !previewPlaceholder) {
    return;
  }

  if (imageUrl) {
    previewImage.src = imageUrl;
    previewImage.alt = `${field(form, "name").value.trim() || "Product"} preview`;
    previewImage.classList.remove("hidden");
    previewPlaceholder.classList.add("hidden");
    return;
  }

  previewImage.removeAttribute("src");
  previewImage.classList.add("hidden");
  previewPlaceholder.classList.remove("hidden");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read the selected image file."));
    reader.readAsDataURL(file);
  });
}

function productFormPayload(form) {
  return {
    name: field(form, "name").value.trim(),
    brand: field(form, "brand").value.trim(),
    category: field(form, "category").value.trim(),
    summary: field(form, "summary").value.trim(),
    description: field(form, "description").value.trim(),
    price: Number(field(form, "price").value || 0),
    stock: Number(field(form, "stock").value || 0),
    image_url: field(form, "image_url").value.trim(),
    highlights: field(form, "highlights").value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    featured: field(form, "featured").checked,
    active: field(form, "active").checked
  };
}

function populateProductForm(product) {
  const form = document.getElementById("product-form");
  field(form, "product_id").value = product?.id || "";
  field(form, "name").value = product?.name || "";
  field(form, "brand").value = product?.brand || "";
  field(form, "category").value = product?.category || "";
  field(form, "summary").value = product?.summary || "";
  field(form, "description").value = product?.description || "";
  field(form, "price").value = product?.price || 0;
  field(form, "stock").value = product?.stock || 0;
  field(form, "image_url").value = product?.image_url || "";
  field(form, "highlights").value = (product?.highlights || []).join(", ");
  field(form, "featured").checked = Boolean(product?.featured);
  field(form, "active").checked = product ? Boolean(product.active) : true;
  field(form, "product_image_file").value = "";
  setProductImagePreview(form, product?.image_url || "");
}

function listFieldValue(value = []) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function splitLines(value = "") {
  return String(value || "")
    .replace(/\r/g, "\n")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function jobFormPayload(form) {
  return {
    title: field(form, "title").value.trim(),
    company: field(form, "company").value.trim(),
    location: field(form, "location").value.trim(),
    job_type: field(form, "job_type").value.trim(),
    salary: field(form, "salary").value.trim(),
    deadline: field(form, "deadline").value,
    categories: splitLines(field(form, "categories").value),
    summary: field(form, "summary").value.trim(),
    about_company: field(form, "about_company").value.trim(),
    responsibilities: splitLines(field(form, "responsibilities").value),
    requirements: splitLines(field(form, "requirements").value),
    benefits: splitLines(field(form, "benefits").value),
    application_email: field(form, "application_email").value.trim(),
    email_subject: field(form, "email_subject").value.trim(),
    how_to_apply: field(form, "how_to_apply").value.trim(),
    featured: field(form, "featured").checked,
    immediate_start: field(form, "immediate_start").checked,
    active: field(form, "active").checked
  };
}

function populateJobForm(job) {
  const form = document.getElementById("job-form");
  if (!form) return;

  field(form, "job_id").value = job?.id || "";
  field(form, "title").value = job?.title || "";
  field(form, "company").value = job?.company || "";
  field(form, "location").value = job?.location || "";
  field(form, "job_type").value = job?.job_type || "";
  field(form, "salary").value = job?.salary || "";
  field(form, "deadline").value = job?.deadline || "";
  field(form, "categories").value = (job?.categories || []).join(", ");
  field(form, "summary").value = job?.summary || "";
  field(form, "about_company").value = job?.about_company || "";
  field(form, "responsibilities").value = listFieldValue(job?.responsibilities);
  field(form, "requirements").value = listFieldValue(job?.requirements);
  field(form, "benefits").value = listFieldValue(job?.benefits);
  field(form, "application_email").value = job?.application_email || "";
  field(form, "email_subject").value = job?.email_subject || "";
  field(form, "how_to_apply").value = job?.how_to_apply || "";
  field(form, "featured").checked = Boolean(job?.featured);
  field(form, "immediate_start").checked = Boolean(job?.immediate_start);
  field(form, "active").checked = job ? Boolean(job.active) : true;
}

function renderProducts() {
  const target = document.getElementById("admin-products");
  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Category</th>
          <th>Store</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${products
          .map(
            (product) => `
              <tr>
                <td>
                  <div class="admin-product-cell">
                    ${productMedia(product, "admin-product-media")}
                    <div>
                      <strong>${product.name}</strong><br>
                      <span class="muted">${product.summary || ""}</span>
                    </div>
                  </div>
                </td>
                <td>${formatMoney(product.price, product.currency)}</td>
                <td>${product.stock}</td>
                <td>${product.category}</td>
                <td>${product.brand || "-"}</td>
                <td>
                  <div class="inline-actions">
                    <button class="button button-ghost" type="button" data-edit-product="${product.id}">Edit</button>
                    <button class="button button-danger" type="button" data-archive-product="${product.id}">Archive</button>
                  </div>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderJobs() {
  const target = document.getElementById("admin-jobs");
  if (!target) return;

  if (!jobs.length) {
    target.innerHTML = `<p class="muted">No job vacancies yet. Use the form to post the first opening.</p>`;
    return;
  }

  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Job</th>
          <th>Type</th>
          <th>Deadline</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${jobs
          .map(
            (job) => `
              <tr>
                <td>
                  <strong>${job.title}</strong><br>
                  <span class="muted">${job.company} - ${job.location}</span>
                </td>
                <td>${job.job_type}</td>
                <td>${job.deadline ? formatDate(job.deadline) : "Open"}</td>
                <td>
                  ${job.active ? '<span class="badge">Available</span>' : '<span class="badge" style="background:var(--soft);">Inactive</span>'}
                  ${job.featured ? '<br><span class="muted">Featured</span>' : ""}
                </td>
                <td>
                  <div class="inline-actions">
                    <button class="button button-ghost" type="button" data-edit-job="${job.id}">Edit</button>
                    <button class="button button-danger" type="button" data-delete-job="${job.id}">Deactivate</button>
                  </div>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderUsers(users) {
  document.getElementById("admin-users").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Role</th>
          <th>Phone</th>
          <th>Monitor</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${users
          .map(
            (user) => `
              <tr>
                <td>
                  <strong>${user.full_name || "Unnamed user"}</strong><br>
                  <span class="muted">${user.email || user.firebase_uid}</span>
                </td>
                <td>${user.role}</td>
                <td>${user.phone || "-"}</td>
                <td>${user.needs_monitoring ? `<span class="status-badge" data-status="pending">Watch</span><br><span class="muted">${user.monitoring_reason || "Duplicate name review"}</span>` : "-"}</td>
                <td>${formatDate(user.created_at)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderOrders(orders) {
  document.getElementById("admin-orders").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Total</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${orders
          .map(
            (order) => `
              <tr>
                <td>
                  <strong>${order.order_number}</strong><br>
                  <span class="muted">${paymentLabel(order)} - ${order.payment_reference}</span>
                </td>
                <td>${order.user?.full_name || order.user?.email || "Customer"}</td>
                <td>${formatMoney(order.total_amount, order.currency)}</td>
                <td>${statusBadge(order.status)}</td>
                <td>${formatDate(order.created_at)}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderPendingDeliveries(orders) {
  const pendingOrders = orders.filter(order => 
    order.status === "payment_pending" || order.status === "confirmed"
  );

  if (pendingOrders.length === 0) {
    document.getElementById("admin-pending-deliveries").innerHTML = `
      <p class="muted">No pending deliveries. All orders are either delivered or completed.</p>
    `;
    return;
  }

  document.getElementById("admin-pending-deliveries").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Total</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${pendingOrders
          .map(
            (order) => `
              <tr>
                <td>
                  <strong>${order.order_number}</strong><br>
                  <span class="muted">${paymentLabel(order)} - ${order.payment_reference}</span>
                </td>
                <td>
                  <strong>${order.user?.full_name || "Customer"}</strong><br>
                  <span class="muted">${order.user?.phone || order.shipping_address?.phone || "-"}</span>
                </td>
                <td><strong>${formatMoney(order.total_amount, order.currency)}</strong></td>
                <td>${statusBadge(order.status)}</td>
                <td>
                  <button class="button button-full" type="button" data-confirm-delivery="${order.id}">
                    <i class="fa-solid fa-check" aria-hidden="true"></i> Seen goods
                  </button>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderInstallations() {
  document.getElementById("admin-installations").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Request</th>
          <th>Customer</th>
          <th>Status</th>
          <th>Assignment</th>
          <th>Save</th>
        </tr>
      </thead>
      <tbody>
        ${installations
          .map(
            (item) => `
              <tr data-installation-row="${item.id}">
                <td>
                  <strong>${item.product?.name || item.service_type}</strong><br>
                  <span class="muted">${item.address}</span>
                </td>
                <td>${item.user?.full_name || item.user?.email || "Customer"}</td>
                <td>
                  <select data-status>
                    ${["pending", "assigned", "completed", "cancelled"]
                      .map(
                        (status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`
                      )
                      .join("")}
                  </select>
                </td>
                <td>
                  <input type="text" value="${item.assigned_to || ""}" data-assigned-to placeholder="Installer or engineer">
                </td>
                <td>
                  <button class="button button-ghost" type="button" data-save-installation="${item.id}">Save</button>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderFeedback(feedbackItems) {
  const target = document.getElementById("admin-feedback");
  if (!target) return;

  if (!feedbackItems.length) {
    target.innerHTML = `<p class="muted" style="padding:1rem;">No feedback submissions yet.</p>`;
    return;
  }

  const stars = (n) => n ? "★".repeat(n) + "☆".repeat(5 - n) : "—";
  const typeLabels = {
    general: "General",
    pre_service: "Before service",
    post_service: "After service",
    product: "Product",
    installation: "Installation",
  };

  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>From</th>
          <th>Type</th>
          <th>Rating</th>
          <th>Message</th>
          <th>Order</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${feedbackItems.map((f) => `
          <tr>
            <td>
              <strong>${f.name}</strong><br>
              ${f.email ? `<a href="mailto:${f.email}" class="muted">${f.email}</a>` : ""}
              ${f.phone ? `<br><span class="muted">${f.phone}</span>` : ""}
            </td>
            <td><span class="badge">${typeLabels[f.service_type] || f.service_type}</span></td>
            <td style="color:#f5a623;letter-spacing:2px;">${stars(f.rating)}</td>
            <td style="max-width:280px;white-space:pre-wrap;">${f.message}</td>
            <td>${f.order_number || "—"}</td>
            <td>${statusBadge(f.status)}</td>
            <td>${formatDate(f.created_at)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

let currentSeason = "default";

function renderSeasonPicker(active) {
  currentSeason = active || "default";
  const picker = document.getElementById("season-picker");
  if (!picker) return;

  picker.innerHTML = Object.entries(SEASON_META).map(([key, meta]) => `
    <button
      type="button"
      class="season-tile ${currentSeason === key ? "is-active" : ""}"
      data-season-key="${key}"
      title="${meta.label}"
    >
      <span class="season-tile-emoji">${meta.emoji || "🌐"}</span>
      <span class="season-tile-label">${meta.label}</span>
    </button>
  `).join("");

  picker.querySelectorAll("[data-season-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentSeason = btn.dataset.seasonKey;
      picker.querySelectorAll("[data-season-key]").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });
}

async function loadSeasonData() {
  try {
    const data = await getSeason();
    renderSeasonPicker(data.season);
    const bannerInput = document.querySelector('input[name="season_banner"]');
    if (bannerInput) bannerInput.value = data.banner || "";
  } catch (_) {
    renderSeasonPicker("default");
  }
}

function renderCoupons(coupons) {
  const target = document.getElementById("admin-coupons");
  if (!target) return;

  if (!coupons.length) {
    target.innerHTML = `<p class="muted" style="padding:1rem;">No coupons yet. Click "New coupon" to create one.</p>`;
    return;
  }

  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Discount</th>
          <th>Min order</th>
          <th>Uses</th>
          <th>Expires</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${coupons.map((c) => `
          <tr>
            <td>
              <strong style="font-family:monospace;letter-spacing:0.05em;">${c.code}</strong>
              ${c.description ? `<br><span class="muted">${c.description}</span>` : ""}
            </td>
            <td>${c.discount_type === "percent" ? `${c.discount_value}%` : formatMoney(c.discount_value)} off</td>
            <td>${c.min_order_amount > 0 ? formatMoney(c.min_order_amount) : "None"}</td>
            <td>${c.uses}${c.max_uses ? ` / ${c.max_uses}` : " / ∞"}</td>
            <td>${c.expires_at ? formatDate(c.expires_at) : "Never"}</td>
            <td>${c.is_active ? '<span class="badge">Active</span>' : '<span class="badge" style="background:var(--soft);">Inactive</span>'}</td>
            <td>
              <div class="inline-actions">
                <button class="button button-ghost" type="button" data-edit-coupon="${c.id}">Edit</button>
                <button class="button button-danger" type="button" data-delete-coupon="${c.id}">Delete</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function couponFormPayload(form) {
  const f = (name) => form.elements.namedItem(name);
  return {
    code: f("code").value.trim().toUpperCase(),
    description: f("description").value.trim() || null,
    discount_type: f("discount_type").value,
    discount_value: Number(f("discount_value").value || 0),
    min_order_amount: Number(f("min_order_amount").value || 0),
    max_uses: f("max_uses").value ? Number(f("max_uses").value) : null,
    is_active: f("is_active").checked,
    expires_at: f("expires_at").value ? new Date(f("expires_at").value).toISOString() : null,
  };
}

function populateCouponForm(coupon) {
  const form = document.getElementById("coupon-form");
  const f = (name) => form.elements.namedItem(name);
  f("coupon_id").value = coupon?.id || "";
  f("code").value = coupon?.code || "";
  f("description").value = coupon?.description || "";
  f("discount_type").value = coupon?.discount_type || "percent";
  f("discount_value").value = coupon?.discount_value || "";
  f("min_order_amount").value = coupon?.min_order_amount || 0;
  f("max_uses").value = coupon?.max_uses || "";
  f("is_active").checked = coupon ? Boolean(coupon.is_active) : true;
  f("expires_at").value = coupon?.expires_at
    ? new Date(coupon.expires_at).toISOString().slice(0, 16)
    : "";
}

async function loadAdminData() {
  const [stats, loadedProducts, users, orders, loadedInstallations, feedbackItems, coupons, loadedJobs] = await Promise.all([
    getAdminStats(),
    listProducts(),
    getAdminUsers(),
    getAdminOrders(),
    getAdminInstallations(),
    getAdminFeedback(),
    getAdminCoupons(),
    getAdminJobs()
  ]);

  products = loadedProducts;
  installations = loadedInstallations;
  jobs = loadedJobs;

  document.getElementById("admin-stats").innerHTML = `
    <!-- Revenue -->
    <article class="stat-card stat-card-wide">
      <div class="stat-card-head">
        <i class="fa-solid fa-sack-dollar" aria-hidden="true"></i>
        <span>Confirmed revenue</span>
      </div>
      <strong>${formatMoney(stats.revenue, stats.currency)}</strong>
      <small class="muted">All-time incl. pending: ${formatMoney(stats.revenue_total, stats.currency)}</small>
    </article>

    <!-- Orders -->
    <article class="stat-card">
      <div class="stat-card-head">
        <i class="fa-solid fa-cart-flatbed" aria-hidden="true"></i>
        <span>Total orders</span>
      </div>
      <strong>${stats.orders}</strong>
      <small class="muted">${stats.orders_confirmed} confirmed · ${stats.orders_pod} pay-on-delivery</small>
    </article>

    <article class="stat-card ${stats.orders_pending > 0 ? "stat-card-alert" : ""}">
      <div class="stat-card-head">
        <i class="fa-solid fa-clock" aria-hidden="true"></i>
        <span>Awaiting transfer</span>
      </div>
      <strong>${stats.orders_pending}</strong>
      <small class="muted">Orders waiting for payment</small>
    </article>

    <article class="stat-card ${stats.receipts_pending > 0 ? "stat-card-alert" : ""}">
      <div class="stat-card-head">
        <i class="fa-solid fa-file-image" aria-hidden="true"></i>
        <span>Receipts to review</span>
      </div>
      <strong>${stats.receipts_pending}</strong>
      <small class="muted">Proof of payment uploaded</small>
    </article>

    <!-- Users -->
    <article class="stat-card">
      <div class="stat-card-head">
        <i class="fa-solid fa-users" aria-hidden="true"></i>
        <span>Registered users</span>
      </div>
      <strong>${stats.users}</strong>
      <small class="muted">${stats.users_flagged > 0 ? `<span style="color:#c0392b">${stats.users_flagged} flagged for review</span>` : "No flags"}</small>
    </article>

    <!-- Products -->
    <article class="stat-card">
      <div class="stat-card-head">
        <i class="fa-solid fa-box-open" aria-hidden="true"></i>
        <span>Active products</span>
      </div>
      <strong>${stats.products}</strong>
      <small class="muted">${stats.products_out_of_stock} out of stock · ${stats.products_low_stock} low stock</small>
    </article>

    <!-- Installations -->
    <article class="stat-card">
      <div class="stat-card-head">
        <i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i>
        <span>Installations</span>
      </div>
      <strong>${stats.installations}</strong>
      <small class="muted">${stats.installations_pending} pending assignment</small>
    </article>

    <!-- Blog -->
    <article class="stat-card">
      <div class="stat-card-head">
        <i class="fa-solid fa-newspaper" aria-hidden="true"></i>
        <span>Blog</span>
      </div>
      <strong>${stats.blog_posts} posts</strong>
      <small class="muted">${stats.blog_subscribers} subscribers</small>
    </article>

    <article class="stat-card">
      <div class="stat-card-head">
        <i class="fa-solid fa-briefcase" aria-hidden="true"></i>
        <span>Careers</span>
      </div>
      <strong>${stats.jobs || 0} jobs</strong>
      <small class="muted">${stats.jobs_featured || 0} featured vacancies</small>
    </article>

    <!-- Feedback -->
    <article class="stat-card ${stats.feedback_new > 0 ? "stat-card-alert" : ""}">
      <div class="stat-card-head">
        <i class="fa-solid fa-star" aria-hidden="true"></i>
        <span>Feedback</span>
      </div>
      <strong>${stats.feedback_new} new</strong>
      <small class="muted">${stats.feedback_total} total submissions</small>
    </article>
  `;

  renderProducts();
  renderJobs();
  renderUsers(users);
  renderPendingDeliveries(orders);
  renderOrders(orders);
  renderInstallations();
  renderFeedback(feedbackItems);
  renderCoupons(coupons);
}

async function init() {
  const profile = await bootstrapPage("admin", { requireAdmin: true });
  if (!profile) {
    return;
  }

  const productForm = document.getElementById("product-form");
  const jobForm = document.getElementById("job-form");
  const inventoryForm = document.getElementById("inventory-upload-form");
  const imageUrlInput = field(productForm, "image_url");
  const productImageFileInput = field(productForm, "product_image_file");

  try {
    await loadAdminData();
    populateProductForm(null);
    populateJobForm(null);
    await loadSeasonData();
  } catch (error) {
    showToast(error.message, "error");
  }

  // Season form
  document.getElementById("season-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("season-save-btn");
    const statusEl = document.getElementById("season-status");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Applying…`;
    try {
      const banner = document.querySelector('input[name="season_banner"]')?.value.trim() || "";
      const data = await setSeason({ season: currentSeason, banner, active: currentSeason !== "default" });
      // Bust the session cache so the change shows immediately
      sessionStorage.removeItem("hoinam_season_cache");
      applySeason(data);
      statusEl.className = "coupon-valid coupon-status";
      statusEl.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Theme set to <strong>${SEASON_META[currentSeason]?.label || currentSeason}</strong>. All visitors will see it immediately.`;
      statusEl.classList.remove("hidden");
      showToast("Season theme applied.", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Apply theme`;
    }
  });

  document.getElementById("season-reset-btn")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("season-status");
    try {
      await setSeason({ season: "default", banner: "", active: false });
      sessionStorage.removeItem("hoinam_season_cache");
      applySeason({ season: "default", active: false });
      renderSeasonPicker("default");
      const bannerInput = document.querySelector('input[name="season_banner"]');
      if (bannerInput) bannerInput.value = "";
      statusEl.className = "coupon-valid coupon-status";
      statusEl.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Theme reset to default.`;
      statusEl.classList.remove("hidden");
      showToast("Theme reset to default.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  imageUrlInput.addEventListener("input", () => {
    setProductImagePreview(productForm);
  });

  productImageFileInput.addEventListener("change", async () => {
    const file = productImageFileInput.files?.[0];
    if (!file) {
      setProductImagePreview(productForm);
      return;
    }

    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      productImageFileInput.value = "";
      showToast("Choose an image smaller than 1.5 MB or paste a hosted image URL.", "error");
      return;
    }

    try {
      imageUrlInput.value = await readFileAsDataUrl(file);
      setProductImagePreview(productForm);
      showToast("Product image loaded into the form.", "success");
    } catch (error) {
      productImageFileInput.value = "";
      showToast(error.message, "error");
    }
  });

  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = productFormPayload(productForm);
      const productId = field(productForm, "product_id").value;
      if (productId) {
        await updateProduct(productId, payload);
        showToast("Product updated.", "success");
      } else {
        await createProduct(payload);
        showToast("Product created.", "success");
      }
      productForm.reset();
      populateProductForm(null);
      await loadAdminData();
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  document.getElementById("clear-product-form").addEventListener("click", () => {
    productForm.reset();
    populateProductForm(null);
  });

  jobForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = jobFormPayload(jobForm);
      const jobId = field(jobForm, "job_id").value;
      if (jobId) {
        await updateJob(jobId, payload);
        showToast("Job listing updated.", "success");
      } else {
        await createJob(payload);
        showToast("Job listing posted.", "success");
      }
      jobForm.reset();
      populateJobForm(null);
      await loadAdminData();
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  document.getElementById("clear-job-form")?.addEventListener("click", () => {
    jobForm.reset();
    populateJobForm(null);
  });

  // Coupon form
  const couponForm = document.getElementById("coupon-form");
  document.getElementById("show-coupon-form-btn")?.addEventListener("click", () => {
    couponForm.classList.toggle("hidden");
    if (!couponForm.classList.contains("hidden")) {
      populateCouponForm(null);
      couponForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  document.getElementById("clear-coupon-form-btn")?.addEventListener("click", () => {
    couponForm.reset();
    populateCouponForm(null);
  });
  couponForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("coupon-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Saving…`;
    try {
      const payload = couponFormPayload(couponForm);
      const couponId = couponForm.elements.namedItem("coupon_id").value;
      if (couponId) {
        await updateCoupon(couponId, payload);
        showToast("Coupon updated.", "success");
      } else {
        await createCoupon(payload);
        showToast("Coupon created.", "success");
      }
      couponForm.reset();
      populateCouponForm(null);
      couponForm.classList.add("hidden");
      await loadAdminData();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save coupon`;
    }
  });

  inventoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = field(inventoryForm, "inventory_file").files[0];
    if (!file) {
      showToast("Choose an Excel file first.", "error");
      return;
    }
    try {
      await uploadInventory(file);
      inventoryForm.reset();
      await loadAdminData();
      showToast("Inventory upload complete.", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  document.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-product]");
    if (editButton) {
      const product = products.find((item) => item.id === Number(editButton.dataset.editProduct));
      if (product) {
        populateProductForm(product);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    const archiveButton = event.target.closest("[data-archive-product]");
    if (archiveButton) {
      const productId = Number(archiveButton.dataset.archiveProduct);
      const product = products.find((item) => item.id === productId);
      if (product && window.confirm(`Archive ${product.name}?`)) {
        try {
          await archiveProduct(productId);
          await loadAdminData();
          showToast("Product archived.", "success");
        } catch (error) {
          showToast(error.message, "error");
        }
      }
      return;
    }

    const editJobButton = event.target.closest("[data-edit-job]");
    if (editJobButton) {
      const job = jobs.find((item) => item.id === Number(editJobButton.dataset.editJob));
      if (job) {
        populateJobForm(job);
        document.getElementById("jobs-management")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
      return;
    }

    const deleteJobButton = event.target.closest("[data-delete-job]");
    if (deleteJobButton) {
      const jobId = Number(deleteJobButton.dataset.deleteJob);
      const job = jobs.find((item) => item.id === jobId);
      if (job && window.confirm(`Deactivate ${job.title}?`)) {
        try {
          await deleteJob(jobId);
          await loadAdminData();
          showToast("Job listing deactivated.", "success");
        } catch (error) {
          showToast(error.message, "error");
        }
      }
      return;
    }

    const confirmDeliveryButton = event.target.closest("[data-confirm-delivery]");
    if (confirmDeliveryButton) {
      const orderId = Number(confirmDeliveryButton.dataset.confirmDelivery);
      if (window.confirm("Confirm that goods have been received? This will approve the payment.")) {
        try {
          confirmDeliveryButton.disabled = true;
          confirmDeliveryButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Confirming...`;
          await confirmDelivery(orderId);
          await loadAdminData();
          showToast("Delivery confirmed and payment approved.", "success");
        } catch (error) {
          showToast(error.message, "error");
        } finally {
          confirmDeliveryButton.disabled = false;
          confirmDeliveryButton.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i> Seen goods`;
        }
      }
      return;
    }

    const saveInstallation = event.target.closest("[data-save-installation]");
    if (saveInstallation) {
      const installationId = Number(saveInstallation.dataset.saveInstallation);
      const row = document.querySelector(`[data-installation-row="${installationId}"]`);
      try {
        await updateInstallationAdmin(installationId, {
          status: row.querySelector("[data-status]").value,
          assigned_to: row.querySelector("[data-assigned-to]").value.trim()
        });
        await loadAdminData();
        showToast("Installation updated.", "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    }

    const editCoupon = event.target.closest("[data-edit-coupon]");
    if (editCoupon) {
      const couponId = Number(editCoupon.dataset.editCoupon);
      const coupons = await getAdminCoupons();
      const coupon = coupons.find((c) => c.id === couponId);
      if (coupon) {
        const couponForm = document.getElementById("coupon-form");
        couponForm.classList.remove("hidden");
        populateCouponForm(coupon);
        couponForm.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    const deleteCouponBtn = event.target.closest("[data-delete-coupon]");
    if (deleteCouponBtn) {
      const couponId = Number(deleteCouponBtn.dataset.deleteCoupon);
      if (window.confirm("Delete this coupon? This cannot be undone.")) {
        try {
          await deleteCoupon(couponId);
          await loadAdminData();
          showToast("Coupon deleted.", "success");
        } catch (error) {
          showToast(error.message, "error");
        }
      }
    }
  });
}

init();
