import { submitFeedback } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { showToast } from "../ui.js";

async function init() {
  await bootstrapPage("feedback");

  // Feedback type card selection
  const typeGrid = document.getElementById("feedback-type-grid");
  typeGrid?.querySelectorAll(".feedback-type-card").forEach((card) => {
    card.addEventListener("click", () => {
      typeGrid.querySelectorAll(".feedback-type-card").forEach((c) => c.classList.remove("is-selected"));
      card.classList.add("is-selected");
    });
  });

  // Star rating
  const starBtns = document.querySelectorAll(".star-btn");
  const ratingInput = document.getElementById("rating-value");
  let currentRating = 0;

  function highlightStars(value) {
    starBtns.forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.value) <= value);
    });
  }

  starBtns.forEach((btn) => {
    btn.addEventListener("mouseenter", () => highlightStars(Number(btn.dataset.value)));
    btn.addEventListener("mouseleave", () => highlightStars(currentRating));
    btn.addEventListener("click", () => {
      const val = Number(btn.dataset.value);
      // Toggle off if clicking the same star
      if (currentRating === val) {
        currentRating = 0;
        ratingInput.value = "";
      } else {
        currentRating = val;
        ratingInput.value = String(val);
      }
      highlightStars(currentRating);
    });
  });

  // Form submit
  const form = document.getElementById("feedback-form");
  const successPanel = document.getElementById("feedback-success");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById("feedback-submit-btn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Sending…`;

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim() || null,
      phone: form.phone.value.trim() || null,
      service_type: form.querySelector('input[name="service_type"]:checked')?.value || "general",
      rating: ratingInput.value ? Number(ratingInput.value) : null,
      message: form.message.value.trim(),
      order_number: form.order_number.value.trim() || null,
    };

    try {
      await submitFeedback(payload);
      form.classList.add("hidden");
      successPanel.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
      showToast("Feedback sent. Thank you!", "success");
    } catch (error) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Send feedback`;
      showToast(error.message, "error");
    }
  });
}

init();
