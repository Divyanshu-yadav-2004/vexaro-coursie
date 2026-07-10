// ============================================================
// upload.js - Drag & Drop File Upload Module for Vexaro KYC
// ============================================================

/**
 * Initialize a drag-and-drop upload zone
 * @param {HTMLElement} zoneEl - The drop zone element
 * @param {Object} options - { onFile(file), accept, maxSize }
 */
function initUploadZone(zoneEl, options = {}) {
  if (!zoneEl) return;
  const { onFile, maxSizeMB = 5 } = options;

  // Click to browse
  zoneEl.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,application/pdf';
    input.onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); };
    input.click();
  });

  // Drag events
  zoneEl.addEventListener('dragenter', e => { e.preventDefault(); zoneEl.classList.add('drag-over'); });
  zoneEl.addEventListener('dragover', e => { e.preventDefault(); zoneEl.classList.add('drag-over'); });
  zoneEl.addEventListener('dragleave', e => { if (!zoneEl.contains(e.relatedTarget)) zoneEl.classList.remove('drag-over'); });
  zoneEl.addEventListener('drop', e => {
    e.preventDefault();
    zoneEl.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  function handleFile(file) {
    const result = validateFile(file, maxSizeMB);
    if (!result.valid) {
      if (typeof showToast === 'function') showToast(result.error, 'error');
      return;
    }
    if (typeof onFile === 'function') onFile(file);
  }
}

/**
 * Validate a file for type and size
 */
function validateFile(file, maxSizeMB = 5) {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    return { valid: false, error: '❌ Invalid file type. Only JPG, JPEG, PNG, and PDF are allowed.' };
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `❌ File size exceeds ${maxSizeMB}MB. Please upload a smaller file.` };
  }
  return { valid: true };
}

/**
 * Generate a preview URL for a file
 * Returns Promise<{ url: string, isPDF: boolean }>
 */
function generatePreview(file) {
  return new Promise((resolve) => {
    if (file.type === 'application/pdf') {
      resolve({ url: null, isPDF: true });
      return;
    }
    const reader = new FileReader();
    reader.onload = e => resolve({ url: e.target.result, isPDF: false });
    reader.readAsDataURL(file);
  });
}

/**
 * Render file preview card inside a container
 */
function renderFilePreview(container, file, previewUrl, isPDF, onRemove) {
  const uploadTime = new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
  const sizeFmt = formatFileSize(file.size);
  const typeFmt = file.type === 'application/pdf' ? 'PDF' : file.type.split('/')[1].toUpperCase();

  const previewHTML = isPDF
    ? `<div class="pdf-preview-icon" aria-label="PDF document">📕<span>PDF</span></div>`
    : `<img src="${previewUrl}" alt="Document preview" class="preview-thumb" onclick="openZoom('${previewUrl}','${sanitizeHTML(file.name)}')">`;

  container.innerHTML = `
    <div class="upload-preview fade-in">
      <div class="preview-media">${previewHTML}</div>
      <div class="file-info-card">
        <div class="file-info-row"><span class="fi-label">📄 File Name</span><span class="fi-value">${sanitizeHTML(file.name)}</span></div>
        <div class="file-info-row"><span class="fi-label">📦 File Size</span><span class="fi-value">${sizeFmt}</span></div>
        <div class="file-info-row"><span class="fi-label">🗂️ File Type</span><span class="fi-value">${typeFmt}</span></div>
        <div class="file-info-row"><span class="fi-label">⏰ Uploaded</span><span class="fi-value">${uploadTime}</span></div>
      </div>
      <button class="btn btn-danger btn-sm remove-btn" onclick="(${onRemove.toString()})()" aria-label="Remove file">
        × Remove & Re-upload
      </button>
    </div>
  `;
}

/**
 * Reset an upload zone to empty state
 */
function removeFile(zoneEl, previewContainer, emptyContent) {
  if (previewContainer) previewContainer.innerHTML = '';
  if (zoneEl) {
    zoneEl.classList.remove('has-file', 'drag-over');
    zoneEl.style.display = '';
  }
  if (emptyContent) emptyContent.style.display = '';
}

// Image Zoom Modal (shared across pages)
let _zoomCurrentUrl = '';
let _zoomCurrentName = '';
let _zoomLevel = 1;

window.openZoom = function (src, name = 'document') {
  _zoomCurrentUrl = src;
  _zoomCurrentName = name;
  _zoomLevel = 1;
  let overlay = document.getElementById('zoom-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'zoom-overlay';
    overlay.className = 'zoom-overlay';
    overlay.innerHTML = `
      <div class="zoom-container" id="zoom-container">
        <img id="zoom-img" class="zoom-img" src="" alt="Document zoom view">
      </div>
      <div class="zoom-controls">
        <button class="zoom-btn" onclick="adjustZoom(-0.25)" aria-label="Zoom out" title="Zoom Out">🔍−</button>
        <span id="zoom-level-label" class="zoom-level">100%</span>
        <button class="zoom-btn" onclick="adjustZoom(0.25)" aria-label="Zoom in" title="Zoom In">🔍+</button>
        <button class="zoom-btn" onclick="downloadZoomImage()" aria-label="Download" title="Download">⬇️</button>
        <button class="zoom-btn zoom-close" onclick="closeZoom()" aria-label="Close" title="Close (ESC)">✕</button>
      </div>
    `;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeZoom(); });
    document.body.appendChild(overlay);
  }
  document.getElementById('zoom-img').src = src;
  document.getElementById('zoom-img').style.transform = 'scale(1)';
  document.getElementById('zoom-level-label').textContent = '100%';
  overlay.classList.add('zoom-open');
  document.body.style.overflow = 'hidden';
};

window.closeZoom = function () {
  const overlay = document.getElementById('zoom-overlay');
  if (overlay) { overlay.classList.remove('zoom-open'); document.body.style.overflow = ''; }
};

window.adjustZoom = function (delta) {
  _zoomLevel = Math.min(3, Math.max(0.5, _zoomLevel + delta));
  const img = document.getElementById('zoom-img');
  if (img) img.style.transform = `scale(${_zoomLevel})`;
  const label = document.getElementById('zoom-level-label');
  if (label) label.textContent = Math.round(_zoomLevel * 100) + '%';
};

window.downloadZoomImage = function () {
  downloadFile(_zoomCurrentUrl, _zoomCurrentName || 'document');
};

// Keyboard shortcuts for zoom modal
document.addEventListener('keydown', e => {
  const overlay = document.getElementById('zoom-overlay');
  if (!overlay || !overlay.classList.contains('zoom-open')) return;
  if (e.key === 'Escape') closeZoom();
  if (e.key === '+' || e.key === '=') adjustZoom(0.25);
  if (e.key === '-') adjustZoom(-0.25);
});
