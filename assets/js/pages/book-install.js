import { createInstallation, listProducts } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { showToast } from "../ui.js";

async function init() {
  const profile = await bootstrapPage("install", { requireAuth: true });
  if (!profile) {
    return;
  }

  const form = document.getElementById("installation-form");
  const select = document.getElementById("product-id");
  const params = new URLSearchParams(window.location.search);

  form.phone.value = profile.phone || "";

  try {
    const products = await listProducts();
    select.innerHTML += products
      .map((product) => `<option value="${product.id}">${product.name}</option>`)
      .join("");
    if (params.get("productId")) {
      select.value = params.get("productId");
    }
  } catch (error) {
    showToast(error.message, "error");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await createInstallation({
        product_id: form.product_id.value ? Number(form.product_id.value) : null,
        preferred_date: form.preferred_date.value || null,
        service_type: form.service_type.value,
        address: form.address.value.trim(),
        city: form.city.value.trim(),
        state: form.state.value.trim(),
        phone: form.phone.value.trim(),
        notes: form.notes.value.trim()
      });
      form.reset();
      showToast("Installation request submitted.", "success");
      window.location.href = "/dashboard.html";
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

init();
