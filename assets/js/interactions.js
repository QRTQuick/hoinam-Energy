const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

let revealObserver;
let countObserver;
let scrollHandlerBound = false;

const revealSelectors = [
  ".hero .container > *",
  ".page-hero .container > *",
  ".section-heading",
  ".stat-card",
  ".feature-card",
  ".product-card",
  ".office-card",
  ".panel",
  ".cta-card",
  ".footer-panel"
];

const tiltSelectors = [
  ".hero-card",
  ".product-card",
  ".feature-card",
  ".office-card",
  ".cta-card",
  ".stat-card",
  ".footer-panel"
];

function prepareRevealTargets(root = document) {
  const elements = root.querySelectorAll(revealSelectors.join(","));
  let index = 0;
  elements.forEach((element) => {
    if (element.dataset.revealReady === "1") {
      return;
    }
    element.dataset.revealReady = "1";
    element.classList.add("reveal-on-scroll");
    element.style.setProperty("--reveal-delay", `${Math.min(index * 70, 280)}ms`);
    index += 1;
    if (prefersReducedMotion.matches) {
      element.classList.add("is-visible");
      return;
    }
    revealObserver?.observe(element);
  });
}

function animateCount(element) {
  const target = Number(element.dataset.countUp || 0);
  if (element.dataset.countAnimated === "1") {
    return;
  }

  element.dataset.countAnimated = "1";

  if (prefersReducedMotion.matches) {
    element.textContent = target.toLocaleString("en-NG");
    return;
  }

  const duration = 900;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(target * eased).toLocaleString("en-NG");
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
}

function prepareCountTargets(root = document) {
  root.querySelectorAll("[data-count-up]").forEach((element) => {
    if (element.dataset.countObserverReady === "1") {
      return;
    }

    element.dataset.countObserverReady = "1";

    if (prefersReducedMotion.matches) {
      animateCount(element);
      return;
    }

    countObserver?.observe(element);
  });
}

function prepareTiltTargets(root = document) {
  if (prefersReducedMotion.matches || !hasFinePointer) {
    return;
  }

  root.querySelectorAll(tiltSelectors.join(",")).forEach((element) => {
    if (element.dataset.tiltReady === "1") {
      return;
    }

    element.dataset.tiltReady = "1";
    element.classList.add("interactive-card");

    element.addEventListener("mousemove", (event) => {
      const rect = element.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const rotateY = ((offsetX / rect.width) - 0.5) * 10;
      const rotateX = (0.5 - (offsetY / rect.height)) * 10;

      element.style.setProperty("--tilt-rotate-x", `${rotateX.toFixed(2)}deg`);
      element.style.setProperty("--tilt-rotate-y", `${rotateY.toFixed(2)}deg`);
      element.style.setProperty("--pointer-x", `${((offsetX / rect.width) * 100).toFixed(2)}%`);
      element.style.setProperty("--pointer-y", `${((offsetY / rect.height) * 100).toFixed(2)}%`);
    });

    element.addEventListener("mouseleave", () => {
      element.style.removeProperty("--tilt-rotate-x");
      element.style.removeProperty("--tilt-rotate-y");
      element.style.removeProperty("--pointer-x");
      element.style.removeProperty("--pointer-y");
    });
  });
}

function bindScrollHeader() {
  if (scrollHandlerBound) {
    return;
  }
  scrollHandlerBound = true;

  const update = () => {
    document.querySelector(".site-header")?.classList.toggle("is-scrolled", window.scrollY > 14);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

function initObservers() {
  if (!prefersReducedMotion.matches && !revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
    );
  }

  if (!prefersReducedMotion.matches && !countObserver) {
    countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
  }
}

export function refreshInteractions(root = document) {
  initObservers();
  bindScrollHeader();
  prepareRevealTargets(root);
  prepareCountTargets(root);
  prepareTiltTargets(root);
}

