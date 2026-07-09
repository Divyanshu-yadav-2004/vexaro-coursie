// ============================================================
// toast.js - Toast Notification System for Vexaro KYC Portal
// ============================================================

(function () {
  const ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  function getContainer() {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      c.className = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  window.showToast = function (message, type = 'info', duration = 4000) {
    const container = getContainer();
    const id = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.id = id;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
      <div class="toast-icon">${ICONS[type] || ICONS.info}</div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" onclick="closeToast('${id}')" aria-label="Close notification">×</button>
      <div class="toast-progress" style="animation-duration:${duration}ms"></div>
    `;
    container.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    // Auto dismiss
    const timer = setTimeout(() => closeToast(id), duration);
    toast._timer = timer;
  };

  window.closeToast = function (id) {
    const toast = document.getElementById(id);
    if (!toast) return;
    clearTimeout(toast._timer);
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 350);
  };

  window.clearAllToasts = function () {
    const container = document.getElementById('toast-container');
    if (container) container.innerHTML = '';
  };
})();
