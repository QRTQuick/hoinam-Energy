import {
  archiveProduct,
  createProduct,
  getAdminInstallations,
  getAdminOrders,
  getAdminStats,
  getAdminUsers,
  listProducts,
  updateInstallationAdmin,
  updateProduct,
  uploadInventory
} from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { formatDate, formatMoney, productMedia, showToast, statusBadge } from "../ui.js";

let products = [];
let installations = [];
const MAX_PRODUCT_IMAGE_BYTES = 1.5 * 1024 * 1024;

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

function renderUsers(users) {
  document.getElementById("admin-users").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Role</th>
          <th>Phone</th>
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
                  <span class="muted">${order.payment_reference}</span>
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

async function loadAdminData() {
  const [stats, loadedProducts, users, orders, loadedInstallations] = await Promise.all([
    getAdminStats(),
    listProducts(),
    getAdminUsers(),
    getAdminOrders(),
    getAdminInstallations()
  ]);

  products = loadedProducts;
  installations = loadedInstallations;

  document.getElementById("admin-stats").innerHTML = `
    <article class="stat-card">
      <div class="stat-card-head">
        <i class="fa-solid fa-sack-dollar" aria-hidden="true"></i>
        <span>Revenue</span>
      </div>
      <strong>${formatMoney(stats.revenue, stats.currency)}</strong>
    </article>
    <article class="stat-card">
      <div class="stat-card-head">
        <i class="fa-solid fa-users" aria-hidden="true"></i>
        <span>Users</span>
      </div>
      <strong>${stats.users}</strong>
    </article>
    <article class="stat-card">
      <div class="stat-card-head">
        <i class="fa-solid fa-cart-flatbed" aria-hidden="true"></i>
        <span>Orders</span>
      </div>
      <strong>${stats.orders}</strong>
    </article>
    <article class="stat-card">
      <div class="stat-card-head">
        <i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i>
        <span>Installations</span>
      </div>
      <strong>${stats.installations}</strong>
    </article>
  `;

  renderProducts();
  renderUsers(users);
  renderOrders(orders);
  renderInstallations();
}

async function init() {
  const profile = await bootstrapPage("admin", { requireAdmin: true });
  if (!profile) {
    return;
  }

  const productForm = document.getElementById("product-form");
  const inventoryForm = document.getElementById("inventory-upload-form");
  const imageUrlInput = field(productForm, "image_url");
  const productImageFileInput = field(productForm, "product_image_file");

  try {
    await loadAdminData();
    populateProductForm(null);
  } catch (error) {
    showToast(error.message, "error");
  }

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
  });
}

init();
