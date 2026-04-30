import { listBlogPosts, subscribeToBlog, unsubscribeFromBlog } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { formatDate, showToast } from "../ui.js";

function renderBlogPost(post) {
  const readingTime = Math.ceil(post.content.split(" ").length / 200);

  return `
    <article class="panel" style="display: flex; flex-direction: column; height: 100%;">
      ${post.image_url ? `<img src="${post.image_url}" alt="${post.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0; margin: -1.5rem -1.5rem 1rem;">` : ""}
      <div style="flex: 1; display: flex; flex-direction: column;">
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
          <span class="badge">${post.category}</span>
          <span class="muted" style="font-size: 0.85rem;">${readingTime} min read</span>
        </div>
        <h3 style="margin: 0 0 0.5rem; flex-grow: 1;">
          <a href="/blog-post.html?slug=${post.slug}" style="color: inherit; text-decoration: none;">
            ${post.title}
          </a>
        </h3>
        <p class="muted" style="margin: 0 0 1rem; flex-grow: 1;">${post.excerpt}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid var(--line);">
          <span class="muted" style="font-size: 0.85rem;">${formatDate(post.published_at || post.created_at)}</span>
          <a href="/blog-post.html?slug=${post.slug}" class="button button-ghost" style="white-space: nowrap;">
            Read more <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </article>
  `;
}

function bindSubscribeForm() {
  const form = document.getElementById("blog-subscribe-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.sub_email.value.trim();
    const name = form.sub_name.value.trim();
    const btn = document.getElementById("blog-subscribe-btn");
    const status = document.getElementById("blog-subscribe-status");

    if (!email) {
      showToast("Please enter your email address.", "error");
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Subscribing…`;

    try {
      await subscribeToBlog(email, name);
      form.reset();
      btn.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Subscribed!`;
      status.className = "blog-subscribe-status blog-subscribe-success";
      status.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> You're subscribed! Check your inbox for a confirmation email.`;
      status.classList.remove("hidden");
    } catch (error) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Subscribe`;
      status.className = "blog-subscribe-status blog-subscribe-error";
      status.innerHTML = `<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${error.message}`;
      status.classList.remove("hidden");
      showToast(error.message, "error");
    }
  });
}

async function handleUnsubscribe(token) {
  const subscribeCard = document.getElementById("blog-subscribe-card");
  const unsubscribeCard = document.getElementById("blog-unsubscribe-card");
  const msg = document.getElementById("blog-unsubscribe-msg");

  if (subscribeCard) subscribeCard.classList.add("hidden");
  if (unsubscribeCard) unsubscribeCard.classList.remove("hidden");

  try {
    await unsubscribeFromBlog(token);
    if (msg) msg.textContent = "You've been unsubscribed.";
  } catch (error) {
    if (msg) msg.textContent = error.message || "This unsubscribe link is invalid or has already been used.";
  }
}

async function init() {
  await bootstrapPage("blog");

  // Handle unsubscribe token in URL
  const params = new URLSearchParams(window.location.search);
  const unsubToken = params.get("unsubscribe");
  if (unsubToken) {
    await handleUnsubscribe(unsubToken);
    // Clean the token from the URL without reloading
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
  }

  try {
    const posts = await listBlogPosts();
    const grid = document.getElementById("blog-posts-grid");
    const noPosts = document.getElementById("blog-no-posts");

    if (!posts || posts.length === 0) {
      grid.style.display = "none";
      noPosts.style.display = "block";
    } else {
      grid.innerHTML = posts.map((post) => renderBlogPost(post)).join("");
      noPosts.style.display = "none";
    }
  } catch (error) {
    showToast(error.message, "error");
  }

  bindSubscribeForm();
}

init();
