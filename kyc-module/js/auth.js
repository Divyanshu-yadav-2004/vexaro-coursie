// ============================================================
// auth.js - Authentication & RBAC for Vexaro KYC Portal
// ============================================================

const SESSION_KEY = 'kyc_session';
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours
const ADMIN_PASSWORD = 'admin@kyc123';
const ADMIN_EMAIL = 'admin@kycportal.com';

/** Create a user session in sessionStorage */
function createUserSession(user) {
  const session = {
    userId: user.id,
    role: 'user',
    name: user.name,
    email: user.email,
    loginAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/** Create an admin session */
function createAdminSession() {
  const session = {
    userId: 'admin',
    role: 'admin',
    name: 'Admin',
    email: ADMIN_EMAIL,
    loginAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/** Get current session (returns null if expired or missing) */
function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/** Check if user is authenticated */
function isAuthenticated() {
  return getSession() !== null;
}

/** Check if current user is admin */
function isAdmin() {
  const session = getSession();
  return session && session.role === 'admin';
}

/** Require authentication, redirect if not logged in */
function requireAuth(redirectTo = 'index.html') {
  const session = getSession();
  if (!session) {
    window.location.href = getCleanUrl(redirectTo);
    return null;
  }
  return session;
}

/** Require admin role, redirect if not admin */
function requireAdmin(redirectTo = 'index.html') {
  const session = getSession();
  if (!session || session.role !== 'admin') {
    window.location.href = getCleanUrl(redirectTo);
    return null;
  }
  return session;
}

/** Logout — clear session and redirect */
function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = getCleanUrl('index.html');
}

/** Check if session is expired */
function isSessionExpired() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return true;
    const session = JSON.parse(raw);
    return Date.now() > session.expiresAt;
  } catch {
    return true;
  }
}

/** Refresh session expiry on activity */
function refreshSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw);
    session.expiresAt = Date.now() + SESSION_DURATION;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* silent */ }
}

/** Get session user data */
function getSessionUser() {
  return getSession();
}

// Auto-refresh session on user activity
;['mousemove', 'keypress', 'click', 'scroll'].forEach(evt => {
  document.addEventListener(evt, debounceRefresh, { passive: true });
});

let _refreshTimer;
function debounceRefresh() {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(refreshSession, 30000);
}

// Check session expiry every 60 seconds
setInterval(() => {
  if (isSessionExpired() && sessionStorage.getItem(SESSION_KEY)) {
    sessionStorage.removeItem(SESSION_KEY);
    if (!window.location.href.includes('index.html')) {
      window.location.href = getCleanUrl('index.html');
    }
  }
}, 60000);
