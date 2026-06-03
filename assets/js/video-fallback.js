/**
 * Video Fallback Handler
 * Ensures videos with fallback images work correctly even if the video file
 * fails to load or is not supported
 */

export function initVideoFallbacks() {
  const videos = document.querySelectorAll("video[poster]");

  videos.forEach(video => {
    // Add error handler
    video.addEventListener("error", (e) => {
      console.warn(`Video failed to load: ${video.src || "unknown"}`);
      // Hide the video element and show the poster as background
      video.style.display = "none";
      const parent = video.parentElement;
      if (parent && video.poster) {
        parent.style.backgroundImage = `url('${video.poster}')`;
        parent.style.backgroundSize = "cover";
        parent.style.backgroundPosition = "center";
      }
    });

    // Add abort handler (for canceled requests)
    video.addEventListener("abort", (e) => {
      console.warn(`Video load aborted: ${video.src || "unknown"}`);
      video.style.display = "none";
    });

    // Add loadstart handler for debugging
    video.addEventListener("loadstart", () => {
      console.debug(`Loading video: ${video.src || "unknown"}`);
    });
  });

  // Also check for any <source> element errors
  const sources = document.querySelectorAll("video source");
  sources.forEach(source => {
    source.addEventListener("error", (e) => {
      console.warn(`Video source failed: ${source.src}`);
      const video = source.closest("video");
      if (video) {
        video.style.display = "none";
        const parent = video.parentElement;
        if (parent && video.poster) {
          parent.style.backgroundImage = `url('${video.poster}')`;
          parent.style.backgroundSize = "cover";
          parent.style.backgroundPosition = "center";
        }
      }
    });
  });
}

// Auto-init if DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVideoFallbacks);
} else {
  initVideoFallbacks();
}
