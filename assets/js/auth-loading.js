/**
 * Auth Loading Manager
 * Displays and manages loading overlay during authentication
 */

export class AuthLoadingManager {
  constructor() {
    this.overlayId = 'auth-loading-overlay';
    this.timeout = null;
  }

  /**
   * Show the auth loading overlay
   */
  show() {
    if (document.getElementById(this.overlayId)) {
      return; // Already visible
    }

    const overlay = document.createElement('div');
    overlay.id = this.overlayId;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      animation: fadeIn 0.3s ease-in;
    `;

    overlay.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2rem;
        background: rgba(255, 255, 255, 0.95);
        padding: 3rem;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        text-align: center;
        backdrop-filter: blur(10px);
      ">
        <div style="
          width: 50px;
          height: 50px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <div>
          <h2 style="font-size: 1.5rem; color: #333; margin: 0 0 0.5rem 0;">Signing you in</h2>
          <p style="font-size: 0.95rem; color: #666; margin: 0;">Please wait while we authenticate your account</p>
        </div>
        <div style="width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden;">
          <div style="
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 2px;
            animation: progress 2s ease-in-out infinite;
          "></div>
        </div>
      </div>

      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 100%; }
          100% { width: 0%; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      </style>
    `;

    document.body.appendChild(overlay);

    // Auto-hide after 15 seconds with fallback redirect
    this.timeout = setTimeout(() => {
      this.hide();
      window.location.href = '/';
    }, 15000);
  }

  /**
   * Hide the auth loading overlay
   */
  hide() {
    const overlay = document.getElementById(this.overlayId);
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => overlay.remove(), 300);
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }
}

export default new AuthLoadingManager();
