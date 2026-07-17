// ============================================================
// utils.js - Shared Utility Functions for Vexaro KYC Portal
// ============================================================

/** Format timestamp to readable date */
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format timestamp to readable date + time */
function formatDateTime(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Time ago string */
function timeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return formatDate(timestamp);
}

/** Format file size in bytes to human-readable */
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

/** Generate a UUID-like unique ID */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/** Get initials from full name */
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('');
}

/** Return HTML badge string for a KYC status */
function getStatusBadge(status) {
  const map = {
    not_started: `<span class="badge badge-not-started">⚪ Not Started</span>`,
    pending:     `<span class="badge badge-pending">🟡 Pending</span>`,
    approved:    `<span class="badge badge-approved">🟢 Approved</span>`,
    rejected:    `<span class="badge badge-rejected">🔴 Rejected</span>`,
  };
  return map[status] || `<span class="badge badge-not-started">⚪ Unknown</span>`;
}

/** Return emoji icon for a status */
function getStatusIcon(status) {
  const map = { not_started: '⚪', pending: '🟡', approved: '🟢', rejected: '🔴' };
  return map[status] || '⚪';
}

/** Validate email address */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Validate Indian mobile number (10 digits) */
function validateMobile(mobile) {
  return /^[6-9]\d{9}$/.test(mobile);
}

/** Validate 6-digit pincode */
function validatePincode(pincode) {
  return /^\d{6}$/.test(pincode);
}

/** Debounce a function */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

/** Trigger a file download from base64 data */
function downloadFile(base64Data, filename, mimeType) {
  const link = document.createElement('a');
  link.href = base64Data;
  link.download = filename;
  link.click();
}

/** Convert base64 string to Blob */
function base64ToBlob(base64, mimeType = 'application/octet-stream') {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type: mimeType });
}

/** Convert File to base64 string (Promise) */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Compress Image File using Canvas and return base64 string */
function compressAndGetBase64(file) {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      fileToBase64(file).then(resolve).catch(reject);
      return;
    }
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      const MAX_DIM = 1000;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
      resolve(compressedBase64);
    };
    img.onerror = () => {
      fileToBase64(file).then(resolve).catch(reject);
    };
  });
}

/** Validate an image file (JPG/JPEG/PNG, max 5MB) */
function isValidImageFile(file) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  return allowed.includes(file.type) && file.size <= 5 * 1024 * 1024;
}

/** Validate document file (JPG/JPEG/PNG/PDF, max 5MB) */
function isValidDocumentFile(file) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  return allowed.includes(file.type) && file.size <= 5 * 1024 * 1024;
}

/** Get icon emoji based on file type */
function getFileTypeIcon(fileType) {
  if (!fileType) return '📄';
  if (fileType.includes('pdf')) return '📕';
  if (fileType.includes('image')) return '🖼️';
  return '📄';
}

/** Sanitize HTML to prevent XSS */
function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/** Copy text to clipboard */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  }
}

/** Get a CSS gradient based on initials for avatar placeholders */
function getGradientByInitials(name) {
  const gradients = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #10b981, #3b82f6)',
    'linear-gradient(135deg, #ec4899, #8b5cf6)',
    'linear-gradient(135deg, #14b8a6, #6366f1)',
    'linear-gradient(135deg, #f97316, #eab308)',
    'linear-gradient(135deg, #06b6d4, #6366f1)',
    'linear-gradient(135deg, #84cc16, #10b981)',
  ];
  const code = (name || 'A').charCodeAt(0);
  return gradients[code % gradients.length];
}

/** Animate a number counting up */
function countUp(element, target, duration = 1000) {
  const start = 0;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/** Show/hide element */
function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }

/** Create avatar HTML (image or initials) */
function createAvatarHTML(user, size = 'md') {
  if (user.profilePhoto) {
    return `<img src="${user.profilePhoto}" class="avatar avatar-${size}" alt="${sanitizeHTML(user.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }
  const initials = getInitials(user.name);
  const gradient = getGradientByInitials(user.name);
  return `<div class="avatar-placeholder avatar-${size}" style="background:${gradient}">${initials}</div>`;
}

/** Save KYC Draft in both localStorage and sessionStorage for bulletproof persistence */
function saveKycDraft(key, draft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (e) {
    console.warn("localStorage quota exceeded, saved in sessionStorage/memory only");
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch (e) {
    console.error("sessionStorage also full!");
  }
}

/** Load KYC Draft checking sessionStorage first (best persistence during page navigation) */
function loadKycDraft(key) {
  let draft = null;
  try {
    draft = JSON.parse(sessionStorage.getItem(key));
  } catch (e) {}
  if (!draft) {
    try {
      draft = JSON.parse(localStorage.getItem(key));
    } catch (e) {}
  }
  return draft;
}

/** Remove KYC Draft from all caches */
function removeKycDraft(key) {
  try { sessionStorage.removeItem(key); } catch (e) {}
  try { localStorage.removeItem(key); } catch (e) {}
}

/** Get clean URL for page navigation based on environment/hosting */
function getCleanUrl(pageNameWithHtml) {
  const hasHtml = window.location.pathname.endsWith('.html');
  if (hasHtml) {
    return pageNameWithHtml;
  } else {
    return pageNameWithHtml.replace(/\.html$/, '');
  }
}
