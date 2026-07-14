// ============================================================
// api.js — Vexaro KYC Frontend API Client
// Replaces localStorage-based storage.js with real HTTP calls
// ============================================================

// In development, Vite proxies /api → localhost:5000 (see vite.config.js)
// In production, set VITE_API_URL in your hosting env vars
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'vexaro_token';

// ─── TOKEN HELPERS ────────────────────────────────────────────
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── FETCH WRAPPER ────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}

// ─── AUTH ─────────────────────────────────────────────────────

/**
 * Login with email + password. Returns { token, user }.
 */
export async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.user;
}

/**
 * Register a new user. Returns { token, user }.
 */
export async function register(profileData) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(profileData),
  });
  setToken(data.token);
  return data.user;
}

/**
 * Get currently logged-in user from JWT. Returns user object or null.
 */
export async function getMe() {
  try {
    const data = await apiFetch('/auth/me');
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Logout: remove JWT token from storage.
 */
export function logout() {
  removeToken();
}

// ─── KYC ─────────────────────────────────────────────────────

/**
 * Submit KYC documents (multipart form upload).
 * @param {File} aadhaarFront
 * @param {File} aadhaarBack
 * @param {File} panCard
 */
export async function submitKYC(aadhaarFront, aadhaarBack, panCard) {
  const formData = new FormData();
  formData.append('aadhaarFront', aadhaarFront);
  formData.append('aadhaarBack', aadhaarBack);
  formData.append('panCard', panCard);

  const data = await apiFetch('/kyc/submit', {
    method: 'POST',
    body: formData,
  });
  return data.kyc;
}

/**
 * Get the current user's KYC record. Returns kyc object or null.
 */
export async function getMyKYC() {
  const data = await apiFetch('/kyc/my');
  return data.kyc;
}

/**
 * Admin/owner: get all KYC records.
 */
export async function getAllKYC() {
  const data = await apiFetch('/kyc/all');
  return data.records;
}

/**
 * Admin/owner: update KYC status.
 * @param {number} kycId
 * @param {'approved'|'rejected'} status
 * @param {string} rejectionReason - required if rejecting
 */
export async function updateKYCStatus(kycId, status, rejectionReason = '') {
  const data = await apiFetch(`/kyc/${kycId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, rejectionReason }),
  });
  return data;
}

// ─── USERS ────────────────────────────────────────────────────

/**
 * Admin/owner: get all users.
 */
export async function getAllUsers() {
  const data = await apiFetch('/users');
  return data.users;
}

/**
 * Update the current user's profile (Step 1 data).
 */
export async function updateProfile(profileData) {
  const data = await apiFetch('/users/profile', {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
  return data.user;
}

/**
 * Fetch all seeded demo users for the role-simulation grid.
 */
export async function getDemoUsers() {
  const data = await apiFetch('/auth/demo-users');
  return data.users;
}

/**
 * Log in passwordlessly for simulation mode. Returns user object.
 */
export async function demoLogin(email) {
  const data = await apiFetch('/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  setToken(data.token);
  return data.user;
}

// ─── LEGACY REDACTION UTILITIES (kept for display use) ────────
export function redactEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return 'e***@example.com';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function redactMobile(mobile) {
  if (!mobile) return '';
  const cleaned = mobile.replace(/\D/g, '');
  if (cleaned.length < 4) return '******';
  return `******${cleaned.slice(-4)}`;
}

export function redactPincode(pincode) {
  if (!pincode) return '';
  return `${pincode.slice(0, 3)}***`;
}

export function redactText(text) {
  if (!text) return '';
  if (text.length <= 4) return '****';
  return `${text.slice(0, 3)}... [REDACTED]`;
}
