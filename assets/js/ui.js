import { logoutUser } from "./firebase.js";
import { clearCachedProfile, getCachedProfile, getCartCount } from "./store.js";

function initialsFromName(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "HE";
}

function slugifyName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const PRODUCT_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

export function resolveProductImageUrls(product = {}) {
  const explicitImage = String(product.image_url || "").trim();
  const urls = [];
  if (explicitImage) {
    urls.push(explicitImage);
  }

  const slug = String(product.slug || "").trim() || slugifyName(product.name || "");
  if (!slug) {
    return urls;
  }

  urls.push(
    ...PRODUCT_IMAGE_EXTENSIONS.map((extension) => `/assets/images/products/${slug}${extension}`)
  );

  return [...new Set(urls)];
}

export function formatMoney(amount, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(amount || 0));
}

export function formatProductPrice(amount, currency = "NGN") {
  return Number(amount || 0) > 0 ? formatMoney(amount, currency) : "Request quote";
}

export function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function statusBadge(status) {
  return `<span class="status-badge" data-status="${status || "pending"}">${status || "pending"}</span>`;
}

export function productMedia(product, className = "product-media") {
  // Validate product object
  if (!product || typeof product !== "object") {
    return `<div class="${className} is-fallback"><div class="fallback-mark">?</div></div>`;
  }
  
  const productName = String(product.name || "Product").trim();
  const fallback = `<div class="fallback-mark">${initialsFromName(productName)}</div>`;
  
  try {
    const imageUrls = resolveProductImageUrls(product);
    const validUrls = imageUrls.filter(url => url && typeof url === "string" && url.trim());
    
    if (!validUrls.length) {
      return `<div class="${className} is-fallback">${fallback}</div>`;
    }

    const [imageUrl] = validUrls;
    const fallbackSources = validUrls.join("|");
    
    return `
      <div class="${className} has-image">
        <img
          src="${imageUrl}"
          alt="${productName}"
          loading="lazy"
          data-fallback-srcs="${fallbackSources}"
          data-fallback-index="0"
          onerror="const sources=(this.dataset.fallbackSrcs||'').split('|').filter(Boolean); const nextIndex=Number(this.dataset.fallbackIndex||'0')+1; if (sources[nextIndex]) { this.dataset.fallbackIndex=String(nextIndex); this.src=sources[nextIndex]; return; } const p=this.parentElement; this.remove(); if(p){p.classList.remove('has-image'); p.classList.add('is-fallback');}"
        >
        ${fallback}
      </div>
    `;
  } catch (error) {
    console.warn("[v0] Error rendering product media:", error);
    return `<div class="${className} is-fallback">${fallback}</div>`;
  }
}

export function renderProductCard(product) {
  try {
    // Validate product object
    if (!product || typeof product !== "object" || !product.id) {
      console.warn("[v0] Invalid product data for card render:", product);
      return '';
    }

    // Extract and validate data with fallbacks
    const productId = Number(product.id || 0);
    const productName = String(product.name || "Product").trim();
    const brand = String(product.brand || product.category || "Solar").trim();
    const category = String(product.category || "Power Solution").trim();
    const stock = Math.max(0, Number(product.stock || 0));
    const price = Number(product.price || 0);
    const currency = String(product.currency || "NGN").trim();
    const stockLabel = stock > 0 ? `${stock} in stock` : "Out of stock";
    const isFeatured = Boolean(product.featured);
    const hasDiscount = Boolean(product.originalPrice && product.originalPrice > price);
    
    const imageUrls = resolveProductImageUrls(product);
    const validImageUrls = imageUrls.filter(url => url && typeof url === "string");
    const imageUrl = validImageUrls[0] || '/assets/images/products/placeholder.svg';
    
    return `
      <article class="product-card" tabindex="0">
        ${isFeatured ? '<span class="product-card-featured">Featured</span>' : ''}
        ${hasDiscount ? '<span class="product-card-sale">Sale</span>' : ''}
        
        <img src="${imageUrl}" alt="${productName}" class="product-card-bg" loading="lazy" onerror="const sources=${JSON.stringify(validImageUrls)}; const nextIndex=Number(this.dataset.index||'0')+1; if (sources[nextIndex]) { this.dataset.index=String(nextIndex); this.src=sources[nextIndex]; return; } this.src='/assets/images/products/placeholder.svg';" data-index="0">
        <div class="product-card-overlay"></div>
        
        <div class="product-card-actions">
          <button class="product-card-action-btn" aria-label="Add to wishlist" onclick="event.stopPropagation(); showToast('Added to wishlist!', 'success');">
            <i class="fa-regular fa-heart"></i>
          </button>
          <button class="product-card-action-btn" aria-label="Quick view" onclick="event.stopPropagation(); window.location.href='/product-detail.html?id=${productId}';">
            <i class="fa-regular fa-eye"></i>
          </button>
          <button class="product-card-action-btn" aria-label="Add to cart" onclick="event.stopPropagation(); addToCart('${productId}');">
            <i class="fa-solid fa-cart-shopping"></i>
          </button>
        </div>
        
        <div class="product-card-content">
          <span class="product-card-brand">${brand}</span>
          <h3 class="product-card-title">${productName}</h3>
          <p class="product-card-category">${category}</p>
          
          <div class="product-card-price">
            <span class="product-card-price-current">${formatProductPrice(price, currency)}</span>
            ${hasDiscount ? `<span class="product-card-price-original">${formatProductPrice(product.originalPrice, currency)}</span>` : ''}
          </div>
          
          <div class="product-card-expanded">
            ${stock > 0 ? `<div class="product-card-stock"><i class="fa-solid fa-check-circle"></i> ${stockLabel}</div>` : `<div class="product-card-stock out-of-stock"><i class="fa-solid fa-times-circle"></i> ${stockLabel}</div>`}
            
            <ul class="product-card-features">
              ${Array.isArray(product.features) && product.features.length ? product.features.slice(0, 3).map(feature => `<li><i class="fa-solid fa-check"></i> ${String(feature || '').trim()}</li>`).join('') : '<li><i class="fa-solid fa-bolt"></i> High efficiency</li><li><i class="fa-solid fa-shield-halved"></i> 2-year warranty</li><li><i class="fa-solid fa-truck-fast"></i> Fast delivery</li>'}
            </ul>
            
            <a href="/product-detail.html?id=${productId}" class="product-card-cta" onclick="event.stopPropagation();">
              View Details <i class="fa-solid fa-arrow-right"></i>
            </a>
          </div>
        </div>
      </article>
    `;
  } catch (error) {
    console.error("[v0] Error rendering product card:", error, product);
    return '';
  }
}

export function renderProductCardMobile(product) {
  try {
    // Validate product object
    if (!product || typeof product !== "object" || !product.id) {
      console.warn("[v0] Invalid product data for mobile card:", product);
      return '';
    }

    const productId = Number(product.id || 0);
    const productName = String(product.name || "Product").trim();
    const brand = String(product.brand || product.category || "Solar").trim();
    const stock = Math.max(0, Number(product.stock || 0));
    const price = Number(product.price || 0);
    const currency = String(product.currency || "NGN").trim();
    const stockLabel = stock > 0 ? `${stock} in stock` : "Out of stock";
    
    return `
      <a class="mob-product-card" href="/product-detail.html?id=${productId}">
        <div class="mob-product-img">
          ${productMedia(product, "mob-product-media")}
        </div>
        <div class="mob-product-info">
          <span class="mob-product-cat">${brand}</span>
          <h3 class="mob-product-name">${productName}</h3>
          <p class="mob-product-price">${formatProductPrice(price, currency)}</p>
          <span class="mob-product-stock ${stock > 0 ? "in" : "out"}">${stockLabel}</span>
        </div>
        <i class="fa-solid fa-chevron-right mob-product-arrow" aria-hidden="true"></i>
      </a>
    `;
  } catch (error) {
    console.error("[v0] Error rendering mobile product card:", error, product);
    return '';
  }
}

export function showToast(message, type = "info") {
  let root = document.querySelector(".toast-root");
  if (!root) {
    root = document.createElement("div");
    root.className = "toast-root";
    document.body.append(root);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  root.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

export function renderOffices() {
  const offices = window.HOINAM_CONFIG?.company?.offices || [];
  return offices
    .map(
      (office) => `
        <article class="office-card">
          <span class="badge">${office.title}</span>
          <h3>${office.title}</h3>
          <p class="muted">${office.address}</p>
        </article>
      `
    )
    .join("");
}

function renderFooterOffices() {
  const offices = window.HOINAM_CONFIG?.company?.offices || [];
  return `
    <article class="footer-panel">
      <span class="badge"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> Offices</span>
      <h3>Office locations</h3>
      <div class="footer-stack">
        ${offices
          .map(
            (office) => `
              <div class="footer-item">
                <strong>${office.title}</strong>
                <p class="muted">${office.address}</p>
              </div>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderFooterFaq() {
  const faqItems = window.HOINAM_CONFIG?.company?.faq || [];
  return `
    <article class="footer-panel">
      <span class="badge"><i class="fa-solid fa-circle-question" aria-hidden="true"></i> FAQ</span>
      <h3>Common questions</h3>
      <div class="footer-stack">
        ${faqItems
          .slice(0, 4)
          .map(
            (item) => `
              <a class="footer-link" href="/about.html#faq">
                <strong>${item.question}</strong>
              </a>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderFooterSocials() {
  const socials = window.HOINAM_CONFIG?.company?.socials || [];
  return `
    <article class="footer-panel">
      <span class="badge"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Socials</span>
      <h3>Company socials</h3>
      <div class="social-links">
        ${socials
          .map((social) =>
            social.href
              ? `
                <a class="social-link" href="${social.href}" target="_blank" rel="noreferrer">
                  <i class="${social.icon}" aria-hidden="true"></i>
                  <span>${social.label}</span>
                </a>
              `
              : `
                <span class="social-link is-disabled">
                  <i class="${social.icon}" aria-hidden="true"></i>
                  <span>${social.label}</span>
                </span>
              `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderFooterLegal() {
  return `
    <article class="footer-panel">
      <span class="badge"><i class="fa-solid fa-scale-balanced" aria-hidden="true"></i> Legal</span>
      <h3>Privacy and cookies</h3>
      <div class="footer-stack">
        <a class="footer-link" href="/privacy.html">
          <strong>Privacy policy</strong>
        </a>
        <a class="footer-link" href="/cookies.html">
          <strong>Cookie policy</strong>
        </a>
        <button class="footer-button" type="button" data-cookie-open>
          <strong>Cookie preferences</strong>
        </button>
        <a class="footer-link" href="/about.html#faq">
          <strong>Support & FAQs</strong>
        </a>
      </div>
    </article>
  `;
}

export function renderCookieBanner(force = false) {
  const existing = document.querySelector(".cookie-banner");
  if (existing) {
    if (force) {
      existing.remove();
    } else {
      return;
    }
  }

  const consent = window.localStorage.getItem("hoinam_cookie_consent");
  if (consent && !force) {
    return;
  }

  const banner = document.createElement("div");
  banner.className = "cookie-banner";
  banner.innerHTML = `
    <div class="cookie-card">
      <div>
        <span class="eyebrow"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Before you continue</span>
        <h3>We use cookies &amp; ask you to accept our terms.</h3>
        <p class="muted">
          By using this site you agree to our
          <a href="/cookies.html" style="color:var(--primary);font-weight:600">Cookie Policy</a>
          and
          <a href="/privacy.html" style="color:var(--primary);font-weight:600">Privacy Policy</a>.
          We store session cookies so you can log in, keep items in your cart, and complete orders.
        </p>
      </div>
      <div class="cookie-actions">
        <button class="button button-ghost" type="button" data-cookie-decline>Decline</button>
        <button class="button" type="button" data-cookie-accept>Accept &amp; continue</button>
      </div>
    </div>
  `;

  document.body.append(banner);

  banner.querySelector("[data-cookie-accept]")?.addEventListener("click", () => {
    window.localStorage.setItem("hoinam_cookie_consent", "accepted");
    banner.remove();
  });

  banner.querySelector("[data-cookie-decline]")?.addEventListener("click", () => {
    window.localStorage.setItem("hoinam_cookie_consent", "declined");
    banner.remove();
  });
}

export function injectShell(activePage) {
  const company = window.HOINAM_CONFIG?.company || {
    name: "Hoinam Energy",
    tagline: "Solar installation, backup products, and energy support"
  };

  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  const active = (page) => (activePage === page ? "is-active" : "");
  const whatsappHref = company.whatsappHref || "https://wa.me/2348140103819?text=Hello%20Hoinam%20Energy%2C%20I%20would%20like%20to%20make%20an%20enquiry.";
  const whatsappNumber = company.whatsappNumber || "08140103819";

  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="container nav-row">

          <!-- Brand -->
          <a class="brand" href="/index.html">
            <span class="brand-mark"><img src="/assets/images/hoinam-logo.png" alt="Hoinam Energy logo"></span>
            <span class="brand-copy">
              <span>${company.name}</span>
            </span>
          </a>

          <!-- Desktop nav -->
          <nav class="site-nav-desktop" aria-label="Main navigation">

            <!-- Home -->
            <a class="snav-link ${active("home")}" href="/index.html">Home</a>

            <!-- Products mega-dropdown -->
            <div class="snav-dropdown-wrap">
              <button class="snav-link snav-dropdown-trigger ${active("products")}" type="button" aria-expanded="false" aria-haspopup="true">
                Products <i class="fa-solid fa-chevron-down snav-chevron" aria-hidden="true"></i>
              </button>
              <div class="snav-mega" role="menu">
                <div class="snav-mega-inner">
                  <a class="snav-product-tile" href="/products.html?store=EcoFlow" role="menuitem">
                    <div class="snav-product-img"><img src="/assets/images/products/river-2-max.png" alt="River 2 Max" loading="lazy"></div>
                    <span class="snav-product-name">EcoFlow Store</span>
                    <span class="snav-product-sub">River and Delta series</span>
                  </a>
                  <a class="snav-product-tile" href="/products.html?store=Bluetti" role="menuitem">
                    <div class="snav-product-img"><img src="/assets/images/products/bluetti-ac180.png" alt="Bluetti AC180" loading="lazy"></div>
                    <span class="snav-product-name">Bluetti Store</span>
                    <span class="snav-product-sub">AC, EP, and B series</span>
                  </a>
                  <a class="snav-product-tile" href="/products.html?store=Deye" role="menuitem">
                    <div class="snav-product-img"><img src="/assets/images/products/deye-sun-6k-sg04lp1-eu-sm2.png" alt="Deye inverter" loading="lazy"></div>
                    <span class="snav-product-name">Deye Store</span>
                    <span class="snav-product-sub">Inverters and batteries</span>
                  </a>
                  <a class="snav-product-tile" href="/products.html" role="menuitem">
                    <div class="snav-product-img snav-product-img-all"><i class="fa-solid fa-store"></i></div>
                    <span class="snav-product-name">All Products</span>
                    <span class="snav-product-sub">Browse catalog</span>
                  </a>
                </div>
              </div>
            </div>

            <!-- About -->
            <a class="snav-link ${active("about")}" href="/about.html">About</a>

            <!-- Blog -->
            <a class="snav-link ${active("blog")}" href="/blog.html">Blog</a>

            <!-- Careers -->
            <a class="snav-link ${active("careers")}" href="/careers.html">Careers</a>

            <!-- Contact -->
            <a class="snav-link ${active("contact")}" href="/contact.html">Contact</a>

            <a class="snav-pill whatsapp-nav-link" href="${whatsappHref}" target="_blank" rel="noreferrer">
              <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp
            </a>

            <!-- Feedback -->
            <a class="snav-link ${active("feedback")}" href="/feedback.html">Feedback</a>

            <!-- Logged-out links -->
            <a class="snav-link snav-auth-out ${active("login")}" data-login-link href="/login.html">Login</a>

            <!-- Logged-in links (hidden until auth) -->
            <a class="snav-link hidden snav-auth-in ${active("install")}" data-install-link href="/book-install.html">Install</a>
            <a class="snav-link hidden snav-auth-in ${active("dashboard")}" data-dashboard-link href="/dashboard.html">Orders</a>
            <a class="snav-pill hidden snav-auth-in ${active("cart")}" data-cart-link href="/cart.html">
              <i class="fa-solid fa-cart-shopping" aria-hidden="true"></i>
              <span data-cart-count>0</span>
            </a>
            <a class="snav-pill snav-pill-admin hidden ${active("admin")}" data-admin-link href="/admin.html">
              <i class="fa-solid fa-user-shield" aria-hidden="true"></i> Admin
            </a>
            <button class="snav-link hidden snav-auth-in" type="button" data-logout-button>Logout</button>

            <!-- Theme toggle -->
          </nav>

          <!-- Mobile toggle -->
          <button class="nav-toggle" type="button" aria-label="Toggle navigation">
            <i class="fa-solid fa-bars" aria-hidden="true"></i>
          </button>

          <!-- Mobile nav -->
          <nav class="site-nav" id="site-nav" aria-label="Mobile navigation">
            <a class="nav-link ${active("home")}" href="/index.html"><i class="fa-solid fa-house" aria-hidden="true"></i><span>Home</span></a>
            <a class="nav-link ${active("products")}" href="/products.html"><i class="fa-solid fa-store" aria-hidden="true"></i><span>Products</span></a>
            <a class="nav-link ${active("about")}" href="/about.html"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>About</span></a>
            <a class="nav-link ${active("blog")}" href="/blog.html"><i class="fa-solid fa-newspaper" aria-hidden="true"></i><span>Blog</span></a>
            <a class="nav-link ${active("careers")}" href="/careers.html"><i class="fa-solid fa-briefcase" aria-hidden="true"></i><span>Careers</span></a>
            <a class="nav-link ${active("contact")}" href="/contact.html"><i class="fa-solid fa-headset" aria-hidden="true"></i><span>Contact</span></a>
            <a class="nav-link whatsapp-mobile-nav" href="${whatsappHref}" target="_blank" rel="noreferrer"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i><span>WhatsApp</span></a>
            <a class="nav-link ${active("feedback")}" href="/feedback.html"><i class="fa-solid fa-star" aria-hidden="true"></i><span>Feedback</span></a>
            <!-- logged-out -->
            <a class="nav-link snav-auth-out ${active("login")}" data-login-link href="/login.html"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i><span>Login</span></a>
            <!-- logged-in -->
            <a class="nav-link hidden snav-auth-in ${active("install")}" data-install-link href="/book-install.html"><i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i><span>Install</span></a>
            <a class="nav-link hidden snav-auth-in ${active("dashboard")}" data-dashboard-link href="/dashboard.html"><i class="fa-solid fa-box" aria-hidden="true"></i><span>Orders</span></a>
            <a class="nav-link hidden snav-auth-in ${active("cart")}" data-cart-link href="/cart.html"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i><span>Cart <span data-cart-count>0</span></span></a>
            <a class="nav-link hidden ${active("admin")}" data-admin-link href="/admin.html"><i class="fa-solid fa-user-shield" aria-hidden="true"></i><span>Admin</span></a>
            <button class="nav-link hidden snav-auth-in" type="button" data-logout-button><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>Logout</span></button>
          </nav>

        </div>
      </header>
    `;
  }

  if (footer) {
    const office = (window.HOINAM_CONFIG?.company?.offices || [])[0];
    const email = window.HOINAM_CONFIG?.company?.email || "marketing@hoinamenergy.com";
    const socials = window.HOINAM_CONFIG?.company?.socials || [];

    footer.innerHTML = `
      <footer class="footer-bw">
        <div class="container footer-bw-inner">

          <div class="footer-bw-brand">
            <img src="/assets/images/hoinam-logo.png" alt="Hoinam Energy logo" class="footer-bw-logo">
            <span class="footer-bw-name">${company.name}</span>
            <p class="footer-bw-about">${company.about || company.tagline}</p>
          </div>

          <div class="footer-bw-col">
            <h4>Quick links</h4>
            <a href="/index.html">Home</a>
            <a href="/products.html">Products</a>
            <a href="/book-install.html">Book Installation</a>
            <a href="/blog.html">Blog</a>
            <a href="/careers.html">Careers</a>
            <a href="/about.html">About</a>
            <a href="/contact.html">Contact</a>
            <a href="/feedback.html">Feedback</a>
          </div>

          <div class="footer-bw-col">
            <h4>Contact</h4>
            ${office ? `<p><i class="fa-solid fa-location-dot"></i> ${office.address}</p>` : ""}
            <p><i class="fa-solid fa-tag"></i> Sales: <a href="mailto:${company.salesEmail || "sales@hoinamenergy.com"}">${company.salesEmail || "sales@hoinamenergy.com"}</a></p>
            <p><i class="fa-solid fa-headset"></i> Support: <a href="mailto:${email}">${email}</a></p>
            <p><i class="fa-brands fa-whatsapp"></i> WhatsApp: <a href="${whatsappHref}" target="_blank" rel="noreferrer">${whatsappNumber}</a></p>
          </div>

          <div class="footer-bw-col">
            <h4>Legal</h4>
            <a href="/privacy.html">Privacy policy</a>
            <a href="/cookies.html">Cookie policy</a>
            <button class="footer-bw-cookie-btn" type="button" data-cookie-open>Cookie preferences</button>
          </div>

        </div>

        <div class="footer-bw-bottom">
          <div class="container footer-bw-bottom-inner">
            <span>&copy; ${new Date().getFullYear()} ${company.name}. All rights reserved.</span>
            <div class="footer-bw-socials">
              ${socials.map(s => s.href
                ? `<a href="${s.href}" target="_blank" rel="noreferrer" aria-label="${s.label}"><i class="${s.icon}"></i></a>`
                : `<span class="footer-bw-social-off" aria-label="${s.label}"><i class="${s.icon}"></i></span>`
              ).join("")}
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  document.querySelector(".whatsapp-float")?.remove();
  const whatsappFloat = document.createElement("a");
  whatsappFloat.className = "whatsapp-float";
  whatsappFloat.href = whatsappHref;
  whatsappFloat.target = "_blank";
  whatsappFloat.rel = "noreferrer";
  whatsappFloat.setAttribute("aria-label", "Chat with Hoinam Energy on WhatsApp");
  whatsappFloat.innerHTML = `
    <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
    <span>WhatsApp</span>
  `;
  document.body.append(whatsappFloat);

  // Dropdown menu toggle (mobile)
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.getElementById("site-nav");

  navToggle?.addEventListener("click", () => {
    siteNav?.classList.toggle("is-open");
  });

  // Close mobile navbar when a link is clicked
  siteNav?.querySelectorAll(".nav-link, .nav-pill").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav?.classList.remove("is-open");
    });
  });

  // Close mobile dropdown when clicking outside
  document.addEventListener("click", (event) => {
    const isToggle = event.target.closest(".nav-toggle");
    const isNav = event.target.closest(".site-nav");
    if (!isToggle && !isNav && siteNav?.classList.contains("is-open")) {
      siteNav?.classList.remove("is-open");
    }
  });

  // Products mega-dropdown (desktop)
  const megaTrigger = document.querySelector(".snav-dropdown-trigger");
  const megaPanel   = document.querySelector(".snav-mega");
  if (megaTrigger && megaPanel) {
    megaTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = megaTrigger.getAttribute("aria-expanded") === "true";
      megaTrigger.setAttribute("aria-expanded", String(!open));
      megaPanel.classList.toggle("is-open", !open);
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".snav-dropdown-wrap")) {
        megaTrigger.setAttribute("aria-expanded", "false");
        megaPanel.classList.remove("is-open");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        megaTrigger.setAttribute("aria-expanded", "false");
        megaPanel.classList.remove("is-open");
      }
    });
  }

  document.querySelectorAll("[data-logout-button]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await logoutUser();
      clearCachedProfile();
      refreshShell();
      showToast("You have been signed out.", "success");
      window.location.href = "/login.html";
    });
  });

  document.querySelectorAll("[data-cookie-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.localStorage.removeItem("hoinam_cookie_consent");
      renderCookieBanner(true);
    });
  });

  refreshShell();
  renderCookieBanner();
}

export function refreshShell() {
  const profile = getCachedProfile();
  const cartCount = getCartCount();

  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(cartCount);
  });

  const loginLinks   = document.querySelectorAll("[data-login-link]");
  const logoutBtns   = document.querySelectorAll("[data-logout-button]");
  const dashLinks    = document.querySelectorAll("[data-dashboard-link]");
  const installLinks = document.querySelectorAll("[data-install-link]");
  const cartLinks    = document.querySelectorAll("[data-cart-link]");
  const adminLinks   = document.querySelectorAll("[data-admin-link]");
  const authInEls    = document.querySelectorAll(".snav-auth-in");
  const authOutEls   = document.querySelectorAll(".snav-auth-out");

  if (profile) {
    authOutEls.forEach(el => el.classList.add("hidden"));
    authInEls.forEach(el => el.classList.remove("hidden"));
    loginLinks.forEach(el => el.classList.add("hidden"));
    logoutBtns.forEach(el => el.classList.remove("hidden"));
    dashLinks.forEach(el => el.classList.remove("hidden"));
    installLinks.forEach(el => el.classList.remove("hidden"));
    cartLinks.forEach(el => el.classList.remove("hidden"));
    if (profile.role === "admin") {
      adminLinks.forEach(el => el.classList.remove("hidden"));
    } else {
      adminLinks.forEach(el => el.classList.add("hidden"));
    }
  } else {
    authOutEls.forEach(el => el.classList.remove("hidden"));
    authInEls.forEach(el => el.classList.add("hidden"));
    loginLinks.forEach(el => el.classList.remove("hidden"));
    logoutBtns.forEach(el => el.classList.add("hidden"));
    dashLinks.forEach(el => el.classList.add("hidden"));
    installLinks.forEach(el => el.classList.add("hidden"));
    cartLinks.forEach(el => el.classList.remove("hidden"));
    adminLinks.forEach(el => el.classList.add("hidden"));
  }
}
