import {
  getAdminBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost
} from "../api.js";
import { bootstrapPage } from "../app-shell.js";
import { formatDate, showToast, statusBadge } from "../ui.js";

let blogPosts = [];

function field(form, name) {
  return form.elements.namedItem(name);
}

function parseTags(input) {
  return input
    .split(",")
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean);
}

function blogFormPayload(form) {
  return {
    title: field(form, "title").value.trim(),
    slug: field(form, "slug").value.trim(),
    excerpt: field(form, "excerpt").value.trim(),
    content: field(form, "content").value.trim(),
    image_url: field(form, "image_url").value.trim(),
    category: field(form, "category").value,
    tags: parseTags(field(form, "tags").value),
    is_published: field(form, "is_published").checked
  };
}

function populateBlogForm(post) {
  const form = document.getElementById("blog-form");
  field(form, "post_id").value = post?.id || "";
  field(form, "title").value = post?.title || "";
  field(form, "slug").value = post?.slug || "";
  field(form, "excerpt").value = post?.excerpt || "";
  field(form, "content").value = post?.content || "";
  field(form, "image_url").value = post?.image_url || "";
  field(form, "category").value = post?.category || "News";
  field(form, "tags").value = (post?.tags || []).join(", ");
  field(form, "is_published").checked = post ? Boolean(post.is_published) : false;
}

function renderBlogPosts() {
  const target = document.getElementById("blog-posts-table");
  
  if (!blogPosts.length) {
    target.innerHTML = `
      <p class="muted" style="text-align: center; padding: 2rem;">
        No blog posts yet. Create your first one above!
      </p>
    `;
    return;
  }

  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Category</th>
          <th>Status</th>
          <th>Published</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${blogPosts
          .map(
            (post) => `
              <tr>
                <td>
                  <strong>${post.title}</strong><br>
                  <span class="muted" style="font-size: 0.85rem;">${post.slug}</span>
                </td>
                <td>${post.category}</td>
                <td>${post.is_published ? '<span class="badge">Published</span>' : '<span class="badge" style="background: var(--soft);">Draft</span>'}</td>
                <td>${post.published_at ? formatDate(post.published_at) : "-"}</td>
                <td>
                  <div class="inline-actions">
                    ${post.is_published
                      ? `<a href="/blog-post.html?slug=${post.slug}" target="_blank" class="button button-ghost" style="font-size: 0.9rem;">View</a>`
                      : `<span style="font-size:0.82rem;color:var(--text-soft);padding:0.3rem 0.6rem;border:1px dashed var(--line);border-radius:8px;">Draft — not live</span>`
                    }
                    <button class="button button-ghost" type="button" data-edit-post="${post.id}" style="font-size: 0.9rem;">Edit</button>
                    <button class="button button-danger" type="button" data-delete-post="${post.id}" style="font-size: 0.9rem;">Delete</button>
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

async function loadPosts() {
  try {
    blogPosts = await getAdminBlogPosts();
    renderBlogPosts();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function init() {
  const profile = await bootstrapPage("admin-blog", { requireAdmin: true });
  if (!profile) {
    return;
  }

  const form = document.getElementById("blog-form");

  try {
    await loadPosts();
    populateBlogForm(null);
  } catch (error) {
    showToast(error.message, "error");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Saving...`;

      const payload = blogFormPayload(form);
      const postId = field(form, "post_id").value;

      if (postId) {
        await updateBlogPost(postId, payload);
        showToast("Blog post updated.", "success");
      } else {
        await createBlogPost(payload);
        showToast("Blog post created.", "success");
      }

      form.reset();
      populateBlogForm(null);
      await loadPosts();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = false;
      submitButton.innerHTML = `<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save post`;
    }
  });

  document.getElementById("clear-blog-form").addEventListener("click", () => {
    form.reset();
    populateBlogForm(null);
  });

  document.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-post]");
    if (editButton) {
      const post = blogPosts.find((item) => item.id === Number(editButton.dataset.editPost));
      if (post) {
        populateBlogForm(post);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    const deleteButton = event.target.closest("[data-delete-post]");
    if (deleteButton) {
      const postId = Number(deleteButton.dataset.deletePost);
      const post = blogPosts.find((item) => item.id === postId);
      
      if (post && window.confirm(`Delete "${post.title}"? This cannot be undone.`)) {
        try {
          deleteButton.disabled = true;
          await deleteBlogPost(postId);
          await loadPosts();
          showToast("Blog post deleted.", "success");
        } catch (error) {
          showToast(error.message, "error");
        } finally {
          deleteButton.disabled = false;
        }
      }
      return;
    }
  });
}

init();
