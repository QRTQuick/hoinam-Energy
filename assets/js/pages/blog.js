import { listBlogPosts, getBlogPost } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { formatDate, showToast } from "../ui.js";

function formatContent(content) {
  // Basic markdown-like formatting
  return content
    .split("\n\n")
    .map(paragraph => `<p>${paragraph.trim()}</p>`)
    .join("");
}

function renderBlogPost(post) {
  const date = new Date(post.published_at || post.created_at);
  const readingTime = Math.ceil(post.content.split(" ").length / 200); // Assume 200 words per minute
  
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

async function init() {
  await bootstrapPage("blog");

  try {
    const posts = await listBlogPosts();
    const grid = document.getElementById("blog-posts-grid");
    const noPosts = document.getElementById("blog-no-posts");

    if (!posts || posts.length === 0) {
      grid.style.display = "none";
      noPosts.style.display = "block";
      return;
    }

    grid.innerHTML = posts.map(post => renderBlogPost(post)).join("");
    noPosts.style.display = "none";

    // Add click handlers for blog post links
    document.querySelectorAll("a[href*='blog-post.html']").forEach(link => {
      link.addEventListener("click", (e) => {
        // Links will navigate naturally
      });
    });
  } catch (error) {
    showToast(error.message, "error");
  }
}

init();
