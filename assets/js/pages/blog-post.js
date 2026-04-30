import { getBlogPost, subscribeToBlog } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { formatDate, showToast } from "../ui.js";

function getSlugFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

function formatContent(content) {
  // Convert markdown-like content to HTML
  return content
    .split("\n\n")
    .map(paragraph => {
      paragraph = paragraph.trim();
      if (!paragraph) return "";
      
      // Convert **bold** to <strong>
      paragraph = paragraph.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      // Convert *italic* to <em>
      paragraph = paragraph.replace(/\*(.*?)\*/g, "<em>$1</em>");
      // Convert links [text](url)
      paragraph = paragraph.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      
      return `<p>${paragraph}</p>`;
    })
    .join("");
}

async function init() {
  await bootstrapPage("blog-post");

  const slug = getSlugFromURL();
  
  if (!slug) {
    document.getElementById("blog-post-container").style.display = "none";
    document.getElementById("blog-post-loading").style.display = "none";
    document.getElementById("blog-post-error").style.display = "block";
    return;
  }

  try {
    const post = await getBlogPost(slug);

    // Update page title and meta tags dynamically
    document.title = `${post.title} | Hoinam Energy Blog`;
    document.querySelector('meta[property="og:title"]').setAttribute("content", post.title);
    document.querySelector('meta[property="og:description"]').setAttribute("content", post.excerpt);
    document.querySelector('meta[name="description"]').setAttribute("content", post.excerpt);
    if (post.image_url) {
      document.querySelector('meta[property="og:image"]').setAttribute("content", post.image_url);
    }

    // Populate post content
    document.getElementById("post-category").textContent = post.category;
    document.getElementById("post-title").textContent = post.title;
    document.getElementById("post-excerpt").textContent = post.excerpt;
    document.getElementById("post-date").textContent = formatDate(post.published_at || post.created_at);
    
    const readingTime = Math.ceil(post.content.split(" ").length / 200);
    document.getElementById("post-reading-time").textContent = `${readingTime} min read`;
    
    if (post.author) {
      document.getElementById("post-author").innerHTML = `
        by <strong>${post.author.full_name || post.author.email}</strong>
      `;
    } else {
      document.getElementById("post-author").style.display = "none";
    }

    // Add image if available
    if (post.image_url) {
      document.getElementById("post-image-container").innerHTML = `
        <img src="${post.image_url}" alt="${post.title}" style="width: 100%; border-radius: 12px; object-fit: cover;">
      `;
    }

    // Add content
    document.getElementById("post-content").innerHTML = formatContent(post.content);

    // Add tags if available
    if (post.tags && post.tags.length > 0) {
      document.getElementById("post-tags-container").innerHTML = `
        <div>
          <strong>Tags:</strong>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
            ${post.tags.map(tag => `<span class="badge">${tag}</span>`).join("")}
          </div>
        </div>
      `;
    }

    // Show post container, hide loading
    document.getElementById("blog-post-container").style.display = "block";
    document.getElementById("blog-post-loading").style.display = "none";
    document.getElementById("blog-post-error").style.display = "none";

    // Wire subscribe form
    const form = document.getElementById("blog-subscribe-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = form.sub_email.value.trim();
        const name = form.sub_name.value.trim();
        const btn = document.getElementById("blog-subscribe-btn");
        const status = document.getElementById("blog-subscribe-status");
        if (!email) { showToast("Please enter your email address.", "error"); return; }
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Subscribing…`;
        try {
          await subscribeToBlog(email, name);
          form.reset();
          btn.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Subscribed!`;
          status.className = "blog-subscribe-status blog-subscribe-success";
          status.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> You're subscribed! Check your inbox for a confirmation.`;
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

  } catch (error) {
    console.error("Error loading blog post:", error);
    document.getElementById("blog-post-container").style.display = "none";
    document.getElementById("blog-post-loading").style.display = "none";
    document.getElementById("blog-post-error").style.display = "block";
  }
}

init();
