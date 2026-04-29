/**
 * Mouse Glow Effect
 * Creates an elegant glow effect that follows the mouse cursor
 */

export class MouseGlow {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.glowSize = options.glowSize || 400;
    this.glowOpacity = options.glowOpacity || 0.15;
    this.glowColor = options.glowColor || "rgba(102, 126, 234, 0.5)";
    this.blurAmount = options.blurAmount || 80;
    
    this.glow = null;
    this.x = 0;
    this.y = 0;
    
    if (this.enabled) {
      this.init();
    }
  }

  init() {
    // Create glow element
    this.glow = document.createElement("div");
    this.glow.id = "mouse-glow";
    this.glow.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: ${this.glowSize}px;
      height: ${this.glowSize}px;
      background: radial-gradient(circle, ${this.glowColor}, transparent);
      border-radius: 50%;
      pointer-events: none;
      z-index: 1;
      filter: blur(${this.blurAmount}px);
      opacity: ${this.glowOpacity};
      transform: translate(-50%, -50%);
      mix-blend-mode: screen;
      will-change: transform;
    `;
    
    document.body.appendChild(this.glow);
    
    // Add CSS for smooth animation
    const style = document.createElement("style");
    style.textContent = `
      #mouse-glow {
        animation: glowPulse 3s ease-in-out infinite;
      }
      
      @keyframes glowPulse {
        0%, 100% { opacity: ${this.glowOpacity}; }
        50% { opacity: ${Math.min(this.glowOpacity * 1.5, 0.3)}; }
      }
    `;
    document.head.appendChild(style);
    
    // Track mouse movement
    document.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    document.addEventListener("mouseout", () => this.handleMouseOut());
    document.addEventListener("mousein", () => this.handleMouseIn());
  }

  handleMouseMove(event) {
    if (!this.glow) return;
    
    this.x = event.clientX;
    this.y = event.clientY;
    
    // Use requestAnimationFrame for smooth tracking
    requestAnimationFrame(() => {
      if (this.glow) {
        this.glow.style.transform = `translate(${this.x}px, ${this.y}px) translate(-50%, -50%)`;
      }
    });
  }

  handleMouseOut() {
    if (this.glow) {
      this.glow.style.opacity = "0";
    }
  }

  handleMouseIn() {
    if (this.glow) {
      this.glow.style.opacity = this.glowOpacity;
    }
  }

  setGlowColor(color) {
    this.glowColor = color;
    if (this.glow) {
      this.glow.style.background = `radial-gradient(circle, ${color}, transparent)`;
    }
  }

  destroy() {
    if (this.glow) {
      this.glow.remove();
      this.glow = null;
    }
  }
}

// Auto-initialize on page load if not disabled
if (typeof window !== "undefined") {
  window.mouseGlow = null;
  
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.mouseGlow) {
      window.mouseGlow = new MouseGlow({
        enabled: true,
        glowSize: 400,
        glowOpacity: 0.15,
        glowColor: "rgba(102, 126, 234, 0.5)",
        blurAmount: 80
      });
    }
  });
}

export default MouseGlow;
