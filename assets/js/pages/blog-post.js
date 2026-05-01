import { getBlogPost, subscribeToBlog } from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { formatDate, showToast } from "../ui.js";

function getSlugFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

function formatContent(content) {
  return content
    .split("\n\n")
    .map(paragraph => {
      paragraph = paragraph.trim();
      if (!paragraph) return "";

      // Headings
      if (/^### /.test(paragraph)) return `<h3>${paragraph.slice(4)}</h3>`;
      if (/^## /.test(paragraph))  return `<h2>${paragraph.slice(3)}</h2>`;
      if (/^# /.test(paragraph))   return `<h1>${paragraph.slice(2)}</h1>`;

      // Horizontal rule
      if (/^---+$/.test(paragraph)) return `<hr>`;

      // Unordered list — lines starting with - or *
      if (/^[-*] /m.test(paragraph)) {
        const items = paragraph
          .split("\n")
          .filter(l => /^[-*] /.test(l.trim()))
          .map(l => `<li>${inlineFormat(l.replace(/^[-*] /, "").trim())}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      // Ordered list
      if (/^\d+\. /m.test(paragraph)) {
        const items = paragraph
          .split("\n")
          .filter(l => /^\d+\. /.test(l.trim()))
          .map(l => `<li>${inlineFormat(l.replace(/^\d+\. /, "").trim())}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }

      return `<p>${inlineFormat(paragraph)}</p>`;
    })
    .join("\n");
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

async function init() {
  await bootstrapPage("blog-post");

  const slug = getSlugFromURL();
  
  if (!slug) {
    document.getElementById("blog-post-container").style.display = "none";
    document.getElementById("blog-post-loading").style.display = "none";
    document.getElementById("blog-post-error").style.display = "block";
    const errorHeading = document.querySelector("#blog-post-error h1");
    const errorMsg = document.querySelector("#blog-post-error p");
    if (errorHeading) errorHeading.textContent = "No post specified";
    if (errorMsg) errorMsg.textContent = "The link is missing a post identifier. Go back to the blog and click a post.";
    return;
  }

  try {
    const post = await getBlogPost(slug);

    // Update page title and meta tags dynamically — guard against missing tags
    document.title = `${post.title} | Hoinam Energy Blog`;
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", post.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", post.excerpt);
    document.querySelector('meta[name="description"]')?.setAttribute("content", post.excerpt);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", post.title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", post.excerpt);
    if (post.image_url) {
      document.querySelector('meta[property="og:image"]')?.setAttribute("content", post.image_url);
      document.querySelector('meta[name="twitter:image"]')?.setAttribute("content", post.image_url);
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
          const result = await subscribeToBlog(email, name);
          form.reset();
          btn.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Subscribed!`;
          status.className = "blog-subscribe-status blog-subscribe-success";
          status.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${result.message || "You're subscribed!"}`;
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
    const errorSection = document.getElementById("blog-post-error");
    errorSection.style.display = "block";
    const errorHeading = errorSection.querySelector("h1");
    const errorMsg = errorSection.querySelector("p");
    if (errorHeading) errorHeading.textContent = "Blog post not found";
    if (errorMsg) {
      errorMsg.textContent = (error.message || "").toLowerCase().includes("not published")
        ? "This post is still a draft. Go to the admin panel, edit the post, check \"Published\", and save."
        : "This post may have been removed or the link is incorrect.";
    }
  }
}

init();
