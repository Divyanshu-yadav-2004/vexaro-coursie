// ============================================================
// storage.js - LocalStorage Data Layer with PostgreSQL Sync
// ============================================================

const USERS_KEY = 'kyc_users';
const KYC_KEY = 'kyc_records';
const ACTIVITY_KEY = 'kyc_activity';

// ─── PRODUCTION BACKEND URL ────────────────────────────────────
// Railway backend service — update this if the Railway URL changes.
const RAILWAY_BACKEND_URL = 'https://vexaro-coursie-production.up.railway.app/api';

function getBackendApiBase() {
  // 1. Runtime override (e.g. injected via <script> before storage.js)
  const explicitConfig = window.VEXARO_API_BASE;
  if (explicitConfig) return explicitConfig.replace(/\/$/, '');

  // 2. Local dev — always hit the local Express server
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalHost) return 'http://localhost:5000/api';

  // 3. Production — use the Railway backend URL directly
  return RAILWAY_BACKEND_URL;
}

const BACKEND_URL = `${getBackendApiBase()}/sync`;

// Debug: Log the API base URL
console.log('Vexaro API Base:', getBackendApiBase());
console.log('Backend URL:', BACKEND_URL);

function summarizeSyncPayload(endpoint, payload = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  if (endpoint === '/kyc') {
    return {
      id: payload.id,
      userId: payload.userId,
      email: payload.email,
      status: payload.status,
      updatedAt: payload.updatedAt,
      documents: {
        aadhaarFront: Boolean(payload.aadhaarFront),
        aadhaarBack: Boolean(payload.aadhaarBack),
        panCard: Boolean(payload.panCard)
      }
    };
  }
  if (endpoint === '/user') {
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      kycStatus: payload.kycStatus,
      updatedAt: payload.updatedAt
    };
  }
  if (endpoint === '/activity') {
    return {
      userId: payload.userId,
      userName: payload.userName,
      action: payload.action,
      timestamp: payload.timestamp
    };
  }
  return payload;
}

function normalizePanValue(value) {
  const cleaned = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleaned) ? cleaned : null;
}

function normalizeDigitsValue(value, length) {
  const cleaned = String(value || '').replace(/\D/g, '');
  return cleaned.length === length ? cleaned : null;
}

function normalizeUserForSync(user = {}) {
  const normalized = { ...user };
  if (normalized.email) normalized.email = String(normalized.email).trim().toLowerCase();
  if (normalized.mobile) normalized.mobile = normalizeDigitsValue(normalized.mobile, 10) || '';
  if (normalized.aadharNum) normalized.aadharNum = normalizeDigitsValue(normalized.aadharNum, 12);
  if (normalized.panNum) normalized.panNum = normalizePanValue(normalized.panNum);
  return normalized;
}

// ─── SYNC STATUS OVERLAYS & NOTIFICATIONS ─────────────────────

function showSyncOverlay(show) {
  let overlay = document.getElementById('initial-sync-overlay');
  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'initial-sync-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;color:#ffffff;font-family:sans-serif;transition:opacity 0.3s ease;';
      
      const spinner = document.createElement('div');
      spinner.style.cssText = 'width:50px;height:50px;border:5px solid rgba(255,255,255,0.1);border-top:5px solid #FF6B00;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:20px;';
      
      const style = document.createElement('style');
      style.innerHTML = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
      document.head.appendChild(style);

      const text = document.createElement('div');
      text.style.cssText = 'font-size:16px;font-weight:bold;letter-spacing:0.05em;';
      text.textContent = 'Synchronizing with Vexaro Database...';

      overlay.appendChild(spinner);
      overlay.appendChild(text);
      document.body.appendChild(overlay);
    }
  } else {
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }
  }
}

function showOfflineBanner(show) {
  let banner = document.getElementById('offline-sync-banner');
  if (show) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'offline-sync-banner';
      banner.style.cssText = 'position:fixed;bottom:10px;left:10px;background:#1d3557;color:#ffffff;padding:7px 10px;border-radius:8px;font-size:10px;font-weight:bold;z-index:80;box-shadow:0 6px 14px rgba(15,23,42,0.16);font-family:sans-serif;line-height:1.35;animation:slideUp 0.3s ease;pointer-events:none;opacity:0.92;';
      banner.innerHTML = '<strong>Local data mode</strong><br><span style="font-weight:normal;opacity:0.85;font-size:9px;">Sync will retry automatically.</span>';
      
      const style = document.createElement('style');
      style.innerHTML = '@keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform: translateY(0); opacity:1; } }';
      document.head.appendChild(style);

      document.body.appendChild(banner);
    }
  } else {
    if (banner) banner.remove();
  }
}

// ─── OFFLINE SYNC QUEUE ────────────────────────────────────────

async function processOfflineQueue() {
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem('kyc_offline_queue')) || []; } catch {}
  if (queue.length === 0) return;

  const remainingQueue = [];
  for (const item of queue) {
    try {
      const res = await fetch(`${BACKEND_URL}${item.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload)
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        remainingQueue.push(item);
      }
    } catch (err) {
      remainingQueue.push(item);
    }
  }

  localStorage.setItem('kyc_offline_queue', JSON.stringify(remainingQueue));
  if (remainingQueue.length === 0) {
    showOfflineBanner(false);
  } else {
    showOfflineBanner(true);
  }
}

async function syncPost(endpoint, payload, options = {}) {
  const { critical = false } = options;
  if (endpoint === '/user') payload = normalizeUserForSync(payload);
  if (!payload.updatedAt) payload.updatedAt = Date.now();

  try {
    console.log('[syncPost] outgoing request', {
      endpoint,
      critical,
      payload: summarizeSyncPayload(endpoint, payload)
    });
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('[syncPost] response received', {
      endpoint,
      status: res.status,
      ok: res.ok,
      success: data && data.success,
      message: data && data.message,
      id: data && data.data && data.data.id,
      userId: data && data.data && data.data.user_id
    });
    if (!res.ok || data.success === false) {
      const detailText = data.details
        ? ` (${[data.details.message, data.details.code, data.details.detail].filter(Boolean).join(' | ')})`
        : '';
      throw new Error(`${data.message || 'Sync failed'}${detailText}`);
    }
    if (!isAdminPage()) processOfflineQueue();
    return data;
  } catch (err) {
    if (critical || isAdminPage()) throw err;
    let queue = [];
    try { queue = JSON.parse(localStorage.getItem('kyc_offline_queue')) || []; } catch {}
    
    // Deduplicate: Keep only the latest update for user/kyc endpoints
    if (endpoint === '/user') {
      const payloadId = payload.id;
      const payloadEmail = payload.email;
      queue = queue.filter(item => {
        if (item.endpoint !== '/user') return true;
        const itemId = item.payload ? item.payload.id : null;
        const itemEmail = item.payload ? item.payload.email : null;
        if (payloadId && itemId && payloadId === itemId) return false;
        if (payloadEmail && itemEmail && payloadEmail.toLowerCase() === itemEmail.toLowerCase()) return false;
        return true;
      });
    } else if (endpoint === '/kyc') {
      const payloadUserId = payload.userId;
      queue = queue.filter(item => {
        if (item.endpoint !== '/kyc') return true;
        const itemUserId = item.payload ? item.payload.userId : null;
        return !(payloadUserId && itemUserId && payloadUserId === itemUserId);
      });
    } else if (endpoint === '/activity') {
      // Prune old activities so they don't bloat the queue
      const activityCount = queue.filter(item => item.endpoint === '/activity').length;
      if (activityCount >= 5) {
        const firstActivityIdx = queue.findIndex(item => item.endpoint === '/activity');
        if (firstActivityIdx !== -1) {
          queue.splice(firstActivityIdx, 1);
        }
      }
    }

    queue.push({ endpoint, payload, timestamp: Date.now() });
    
    try {
      localStorage.setItem('kyc_offline_queue', JSON.stringify(queue));
    } catch (writeErr) {
      console.warn('LocalStorage quota exceeded for offline queue:', writeErr.message);
      // Fallback: prune activity items from the queue
      queue = queue.filter(item => item.endpoint !== '/activity');
      try {
        localStorage.setItem('kyc_offline_queue', JSON.stringify(queue));
      } catch (finalErr) {
        console.error('Critical: LocalStorage full. Dropping older queue items to free up space.');
        if (queue.length > 1) {
          queue = queue.slice(Math.floor(queue.length / 2));
          try {
            localStorage.setItem('kyc_offline_queue', JSON.stringify(queue));
          } catch (e) {
            localStorage.removeItem('kyc_offline_queue');
          }
        } else {
          localStorage.removeItem('kyc_offline_queue');
        }
      }
    }
    showOfflineBanner(true);
    return null;
  }
}

// ─── INCREMENTAL SYNC & CONFLICT RESOLUTION ───────────────────

function isAdminPage() {
  return /(^|\/)admin-(dashboard|detail)\.html$/i.test(window.location.pathname);
}

// Admin pages use PostgreSQL as the sole source of truth (in-memory cache only).
// Never persist admin datasets to localStorage — large KYC payloads can exceed quota
// and shared localStorage is vulnerable to cross-tab overwrites from the user portal.
const ADMIN_SESSION_CACHE_KEY = 'vexaro_admin_cache';
const ADMIN_SESSION_CACHE_TTL_MS = 5 * 60 * 1000;

const adminDataCache = {
  users: null,
  records: null,
  activities: null,
  loadedAt: 0
};

let adminDataLoadPromise = null;

function readLocalArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function buildAdminLocalFallbackData() {
  const users = readLocalArray(USERS_KEY);
  const records = readLocalArray(KYC_KEY);
  const activities = normalizeActivityLogs(readLocalArray(ACTIVITY_KEY));

  if (users.length === 0 && records.length === 0 && activities.length === 0) {
    return null;
  }

  return { users, records, activities, source: 'localStorage' };
}

function hasAdminCache() {
  return isAdminPage() && Array.isArray(adminDataCache.users);
}

function persistAdminCacheToSession(users, records, activities) {
  if (!isAdminPage()) return;
  try {
    sessionStorage.setItem(ADMIN_SESSION_CACHE_KEY, JSON.stringify({
      users,
      records,
      activities,
      cachedAt: Date.now()
    }));
  } catch (err) {
    console.warn('Admin session cache skipped (storage quota):', err.message);
  }
}

function hydrateAdminCacheFromSession() {
  if (!isAdminPage() || hasAdminCache()) return false;
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!validateSyncPayload(parsed)) return false;
    if (Date.now() - (parsed.cachedAt || 0) > ADMIN_SESSION_CACHE_TTL_MS) return false;
    if (parsed.records.length === 0) {
      const fallback = buildAdminLocalFallbackData();
      if (fallback && fallback.records.length > 0) {
        setAdminCache(fallback.users, fallback.records, fallback.activities, {
          persist: false,
          source: fallback.source
        });
        return true;
      }
    }
    setAdminCache(parsed.users, parsed.records, parsed.activities, { persist: false });
    return true;
  } catch (err) {
    console.warn('Failed to hydrate admin cache from session:', err.message);
    return false;
  }
}

function setAdminCache(users, records, activities, options = {}) {
  const { persist = true, source = 'database' } = options;
  adminDataCache.users = users;
  adminDataCache.records = records;
  adminDataCache.activities = activities;
  adminDataCache.loadedAt = Date.now();
  adminDataCache.source = source;
  if (persist) persistAdminCacheToSession(users, records, activities);
}

function ensureAdminDataLoaded(options = {}) {
  if (hasAdminCache()) return Promise.resolve(adminDataCache);
  if (adminDataLoadPromise) return adminDataLoadPromise;

  hydrateAdminCacheFromSession();
  if (hasAdminCache()) return Promise.resolve(adminDataCache);

  adminDataLoadPromise = refreshAdminDataFromDatabase({
    silent: options.silent !== false
  }).finally(() => {
    adminDataLoadPromise = null;
  });
  return adminDataLoadPromise;
}

function validateSyncPayload(data) {
  return Boolean(
    data &&
    data.success !== false &&
    Array.isArray(data.users) &&
    Array.isArray(data.records) &&
    Array.isArray(data.activities)
  );
}

async function syncDelete(endpoint, payload) {
  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'Delete sync failed');
    }
    return data;
  } catch (err) {
    console.error('Backend delete failed:', err.message);
    throw err;
  }
}

async function initStorageFromBackend(options = {}) {
  const { forceFull = false, requireDatabase = false, replaceCache = false } = options;
  const lastSync = forceFull ? 0 : Number(localStorage.getItem('kyc_last_sync')) || 0;

  try {
    console.log('[initStorageFromBackend] fetching sync data', {
      since: lastSync,
      forceFull,
      requireDatabase,
      replaceCache,
      adminPage: isAdminPage()
    });
    const res = await fetch(`${BACKEND_URL}?since=${lastSync}`);
    const data = await res.json();
    console.log('[initStorageFromBackend] fetch response', {
      status: res.status,
      ok: res.ok,
      success: data && data.success,
      users: Array.isArray(data && data.users) ? data.users.length : null,
      records: Array.isArray(data && data.records) ? data.records.length : null,
      activities: Array.isArray(data && data.activities) ? data.activities.length : null
    });
    if (!res.ok || data.success === false) throw new Error(data.message || 'Sync request failed');

    showOfflineBanner(false);

    if (replaceCache) {
      if (!validateSyncPayload(data)) {
        throw new Error('Invalid database response — existing records were kept');
      }

      let users = data.users;
      let records = data.records;
      let activities = data.activities;
      let source = 'database';

      if (isAdminPage() && records.length === 0) {
        const fallback = buildAdminLocalFallbackData();
        if (fallback && fallback.records.length > 0) {
          console.warn('[admin-data] database returned no KYC records; showing old browser data instead', {
            users: fallback.users.length,
            records: fallback.records.length,
            activities: fallback.activities.length
          });
          users = fallback.users;
          records = fallback.records;
          activities = fallback.activities;
          source = fallback.source;
        }
      }

      if (isAdminPage()) {
        setAdminCache(users, records, activities, { source });
      } else {
        saveUsers(users);
        saveKYCRecords(records);
        saveActivityLogs(activities);
        localStorage.setItem('kyc_last_sync', String(Date.now()));
      }
      if (!isAdminPage()) processOfflineQueue();
      window.dispatchEvent(new CustomEvent('vexaro-admin-data-refreshed'));
      return { users, records, activities };
    }

    // 1. Conflict Resolution for Users
    if (data.users && data.users.length > 0) {
      let localUsers = getUsers();
      data.users.forEach(dbU => {
        const idx = localUsers.findIndex(u => u.email.toLowerCase() === dbU.email.toLowerCase());
        if (idx === -1) {
          localUsers.push(dbU);
        } else {
          const localUpdatedAt = localUsers[idx].updatedAt || 0;
          if (dbU.updatedAt > localUpdatedAt) {
            localUsers[idx] = { ...localUsers[idx], ...dbU };
          }
        }
      });
      saveUsers(localUsers);
    }

    // 2. Conflict Resolution for KYC Records
    if (data.records && data.records.length > 0) {
      let localRecords = getKYCRecords();
      data.records.forEach(dbK => {
        const idx = localRecords.findIndex(r => idsMatch(r.userId, dbK.userId));
        if (idx === -1) {
          localRecords.push(dbK);
        } else {
          const localUpdatedAt = localRecords[idx].updatedAt || 0;
          if (dbK.updatedAt > localUpdatedAt) {
            localRecords[idx] = { ...localRecords[idx], ...dbK };
          }
        }
      });
      saveKYCRecords(localRecords);
    }

    // 3. Sync Activities
    if (data.activities && data.activities.length > 0) {
      let localActivities = getActivityLogs();
      data.activities.forEach(dbA => {
        const idx = localActivities.findIndex(a => a.id === dbA.id);
        if (idx === -1) {
          localActivities.unshift(dbA);
        }
      });
      localActivities.sort((a, b) => b.timestamp - a.timestamp);
      saveActivityLogs(localActivities.slice(0, 500));
    }

    localStorage.setItem('kyc_last_sync', String(Date.now()));
    processOfflineQueue();
    return true;
  } catch (err) {
    console.warn('Backend sync unavailable, using localStorage cache:', err.message);
    if (isAdminPage()) {
      const fallback = buildAdminLocalFallbackData();
      if (fallback) {
        setAdminCache(fallback.users, fallback.records, fallback.activities, {
          source: fallback.source,
          persist: false
        });
        window.dispatchEvent(new CustomEvent('vexaro-admin-data-refreshed'));
        return fallback;
      }
    }
    if (requireDatabase) {
      showOfflineBanner(false);
      throw err;
    }
    showOfflineBanner(true);
    return false;
  }
}

function refreshAdminDataFromDatabase(options = {}) {
  return initStorageFromBackend({
    forceFull: true,
    requireDatabase: !options.silent,
    replaceCache: true
  });
}

// ─── User CRUD ───────────────────────────────────────────────

function getUsers() {
  if (isAdminPage()) {
    if (!hasAdminCache()) {
      // Auto-refresh from database if cache is empty (e.g., after page refresh)
      refreshAdminDataFromDatabase({ silent: true }).catch(err => {
        console.warn('Failed to auto-refresh admin data:', err.message);
      });
    }
    return hasAdminCache() ? adminDataCache.users : [];
  }
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch { return []; }
}

function saveUsers(users) {
  if (isAdminPage()) {
    adminDataCache.users = users;
    return;
  }
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save users to localStorage (quota exceeded):', err);
  }
}

function normalizeId(value) {
  if (value === undefined || value === null) return { raw: '', number: null };
  const raw = String(value).trim().toLowerCase();
  const match = raw.match(/^(?:user|kyc|u|k)?-?(\d+)$/);
  return {
    raw,
    number: match ? Number(match[1]) : null
  };
}

function idsMatch(a, b) {
  const left = normalizeId(a);
  const right = normalizeId(b);
  if (!left.raw || !right.raw) return false;
  if (left.raw === right.raw) return true;
  return left.number !== null && right.number !== null && left.number === right.number;
}

function getUserById(id) {
  return getUsers().find(u => idsMatch(u.id, id)) || null;
}

function getUserByEmail(email) {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

async function createUser(userData) {
  const users = getUsers();
  const nameParts = (userData.name || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const newUser = {
    id: generateId(),
    name: userData.name || '',
    firstName: firstName,
    lastName: lastName,
    email: userData.email || '',
    mobile: userData.mobile || '',
    address: userData.address || '',
    city: userData.city || '',
    state: userData.state || '',
    pincode: userData.pincode || '',
    gender: userData.gender || 'male',
    agencyName: userData.agencyName || 'Vexaro Courier and Cargo',
    amazonTag: userData.amazonTag || 'na',
    isActive: userData.isActive !== undefined ? userData.isActive : true,
    isBlocked: userData.isBlocked !== undefined ? userData.isBlocked : false,
    passwordReset: userData.passwordReset !== undefined ? userData.passwordReset : false,
    createdBy: userData.createdBy || 'self',
    profilePhoto: userData.profilePhoto || null,
    role: userData.role || 'user',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    kycStatus: 'not_started',
    kycId: null,
    ...userData
  };
  users.push(newUser);
  saveUsers(users);
  await syncPost('/user', newUser, { critical: false });
  return newUser;
}

async function updateUser(id, data) {
  const users = getUsers();
  const idx = users.findIndex(u => idsMatch(u.id, id));
  if (idx === -1) return null;

  if (data.name !== undefined) {
    const nameParts = (data.name || '').trim().split(' ');
    data.firstName = nameParts[0] || '';
    data.lastName = nameParts.slice(1).join(' ') || '';
  }

  users[idx] = { ...users[idx], ...data, updatedAt: Date.now() };
  saveUsers(users);
  await syncPost('/user', users[idx], { critical: isAdminPage() });
  return users[idx];
}

async function deleteUser(id) {
  const user = getUserById(id);
  const users = getUsers().filter(u => !idsMatch(u.id, id));
  saveUsers(users);
  if (user?.email) {
    await syncDelete('/user', { email: user.email });
  }
}

// ─── KYC Records CRUD ────────────────────────────────────────

function getKYCRecords() {
  if (isAdminPage()) {
    if (!hasAdminCache()) {
      // Auto-refresh from database if cache is empty (e.g., after page refresh)
      refreshAdminDataFromDatabase({ silent: true }).catch(err => {
        console.warn('Failed to auto-refresh admin data:', err.message);
      });
    }
    return hasAdminCache() ? adminDataCache.records : [];
  }
  try { return JSON.parse(localStorage.getItem(KYC_KEY)) || []; }
  catch { return []; }
}

function saveKYCRecords(records) {
  if (isAdminPage()) {
    adminDataCache.records = records;
    return;
  }
  try {
    localStorage.setItem(KYC_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save KYC records to localStorage (quota exceeded):', err);
  }
}

function getKYCByUserId(userId) {
  return getKYCRecords().find(k => idsMatch(k.userId, userId)) || null;
}

function getKYCById(id) {
  return getKYCRecords().find(k => idsMatch(k.id, id)) || null;
}

async function createKYC(kycData, options = {}) {
  const records = getKYCRecords();
  const newKYC = {
    id: generateId(),
    userId: kycData.userId,
    aadhaarFront: kycData.aadhaarFront || null,
    aadhaarBack: kycData.aadhaarBack || null,
    panCard: kycData.panCard || null,
    status: 'pending',
    submittedAt: Date.now(),
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    approvedOn: null,
    timeline: kycData.timeline || [],
    updatedAt: Date.now()
  };

  const user = getUserById(kycData.userId);
  if (!user || !user.email) {
    throw new Error('KYC submission cannot be saved because the user email is missing.');
  }

  // Always save to localStorage FIRST so the record is never lost,
  // then attempt backend sync. A network failure here must NEVER block
  // the user — syncPost already queues the payload for the next retry.
  records.push(newKYC);
  saveKYCRecords(records);

  try {
    await syncPost('/user', user, { critical: false });
    await syncPost('/kyc', { ...newKYC, email: user.email }, { critical: false });
  } catch (syncErr) {
    // Backend unavailable — data is already in localStorage and the
    // offline queue will retry automatically every 30 seconds.
    console.warn('[createKYC] Backend sync skipped (offline queue active):', syncErr.message);
  }

  return newKYC;
}

async function updateKYC(id, data) {
  const records = getKYCRecords();
  const idx = records.findIndex(k => idsMatch(k.id, id));
  if (idx === -1) return null;
  
  records[idx] = { ...records[idx], ...data, updatedAt: Date.now() };
  saveKYCRecords(records);

  const user = getUserById(records[idx].userId);
  const syncResult = await syncPost('/kyc', { ...records[idx], email: user ? user.email : '' }, { critical: isAdminPage() });
  if (syncResult?.data?.whatsapp) {
    records[idx].whatsapp = syncResult.data.whatsapp;
    saveKYCRecords(records);
  }
  return records[idx];
}

async function deleteKYC(id) {
  const record = getKYCById(id);
  const user = record ? getUserById(record.userId) : null;
  saveKYCRecords(getKYCRecords().filter(k => !idsMatch(k.id, id)));
  if (user?.email) {
    await syncDelete('/kyc', { email: user.email });
  }
}

function getKYCStats() {
  const records = getKYCRecords();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  return {
    total: records.length,
    pending: records.filter(r => r.status === 'pending').length,
    approved: records.filter(r => r.status === 'approved').length,
    rejected: records.filter(r => r.status === 'rejected').length,
    today: records.filter(r => r.submittedAt >= today.getTime()).length,
    thisMonth: records.filter(r => r.submittedAt >= monthStart).length
  };
}

// ─── Activity Log ─────────────────────────────────────────────

function getActivityLogs() {
  if (isAdminPage()) {
    if (!hasAdminCache()) {
      // Auto-refresh from database if cache is empty (e.g., after page refresh)
      refreshAdminDataFromDatabase({ silent: true }).catch(err => {
        console.warn('Failed to auto-refresh admin data:', err.message);
      });
    }
    return hasAdminCache() ? (adminDataCache.activities || []) : [];
  }
  try { return normalizeActivityLogs(JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || []); }
  catch { return []; }
}

function saveActivityLogsLegacy(newLog) {
    try {
        // 1. Fetch current logs, default to an empty array if empty
        let logs = [];
        const existingLogs = localStorage.getItem('kyc_activity');
        if (existingLogs) {
            logs = JSON.parse(existingLogs);
        }
        
        // 2. Add the newest log to the very top of the list
        logs.unshift(newLog); 
        
        // 3. 🚨 THE CAP: Slice the array to keep only the 15 most recent logs
        // This stops the data from bloating and exceeding the 5MB quota
        if (logs.length > 15) {
            logs = logs.slice(0, 15);
        }
        
        // 4. Save the safely capped array back to localStorage
        localStorage.setItem('kyc_activity', JSON.stringify(logs));
    } catch (err) {
        // If it still hits an issue, catch it safely without crashing the UI
        console.warn('LocalStorage quota limit managed. Active stream preferred.', err);
    }
}

function normalizeActivityLogs(value) {
  const list = Array.isArray(value) ? value.flat(Infinity) : [];
  return list
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))
    .slice(0, 50);
}

function saveActivityLogs(input) {
  try {
    const existingLogs = normalizeActivityLogs(JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || []);
    const logs = Array.isArray(input)
      ? normalizeActivityLogs(input)
      : normalizeActivityLogs([input, ...existingLogs]);

    try {
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(logs));
    } catch (quotaErr) {
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(logs.slice(0, 15)));
    }
  } catch (err) {
    console.warn('LocalStorage quota limit managed. Active stream preferred.', err);
  }
}

function getActivityByUserId(userId) {
  return getActivityLogs().filter(a => idsMatch(a.userId, userId));
}

function logActivity(userId, userName, action, details = {}, icon = '📋') {
  const newLog = { id: generateId(), userId, userName, action, timestamp: Date.now(), details, icon };
  // saveActivityLogs expects a single log object to prepend (not a full array)
  saveActivityLogs(newLog);
  syncPost('/activity', newLog);
}

function getRecentActivity(limit = 10) {
  return getActivityLogs().slice(0, limit);
}

// ─── Demo Data Seeder (Offline Fallback) ───────────────────────

function seedDemoData() {
  if (getUsers().length > 0) return;

  const now = Date.now();
  const day = 86400000;

  const users = [
    { id: 'u1', name: 'Rahul Sharma', firstName: 'Rahul', lastName: 'Sharma', email: 'rahul@example.com', mobile: '9876543210', address: '12 MG Road', addressLine2: 'Near High School', state: 'Maharashtra', city: 'Mumbai', pincode: '400001', billAddress: '12 MG Road', billAddress2: 'Near High School', billLandmark: 'Opposite Police Station', billCity: 'Mumbai', billState: 'Maharashtra', billPinCode: '400001', aadharNum: '592810483920', panNum: 'ABCDE1234F', bankName: 'State Bank of India', gender: 'male', agencyName: 'Vexaro Courier and Cargo', amazonTag: 'na', isActive: true, isBlocked: false, passwordReset: false, createdBy: 'superadmin', profilePhoto: null, role: 'user', createdAt: now - 10 * day, kycStatus: 'pending', kycId: 'k1' },
    { id: 'u2', name: 'Priya Patel', firstName: 'Priya', lastName: 'Patel', email: 'priya@example.com', mobile: '9845678901', address: '45 Nehru Nagar', addressLine2: 'Sector 4', state: 'Gujarat', city: 'Ahmedabad', pincode: '380001', billAddress: '45 Nehru Nagar', billAddress2: 'Sector 4', billLandmark: 'Opposite Garden', billCity: 'Ahmedabad', billState: 'Gujarat', billPinCode: '380001', aadharNum: '918204938201', panNum: 'XYZPQ5678A', bankName: 'HDFC Bank', gender: 'female', agencyName: 'Velocity Logistics', amazonTag: 'vlc101', isActive: true, isBlocked: false, passwordReset: false, createdBy: 'superadmin', profilePhoto: null, role: 'user', createdAt: now - 8 * day, kycStatus: 'approved', kycId: 'k2' },
    { id: 'u3', name: 'Amit Kumar', firstName: 'Amit', lastName: 'Kumar', email: 'amit@example.com', mobile: '9712345678', address: '7 Civil Lines', addressLine2: 'Mall Road', state: 'Delhi', city: 'New Delhi', pincode: '110001', billAddress: '7 Civil Lines', billAddress2: 'Mall Road', billLandmark: 'Near City Metro', billCity: 'New Delhi', billState: 'Delhi', billPinCode: '110001', aadharNum: '782910384910', panNum: 'LMNOP2468B', bankName: 'ICICI Bank', gender: 'male', agencyName: 'Raza Courier And Cargo', amazonTag: 'na', isActive: true, isBlocked: false, passwordReset: false, createdBy: 'superadmin', profilePhoto: null, role: 'user', createdAt: now - 5 * day, kycStatus: 'rejected', kycId: 'k3' },
    { id: 'u4', name: 'Sneha Reddy', firstName: 'Sneha', lastName: 'Reddy', email: 'sneha@example.com', mobile: '9988776655', address: '23 Jubilee Hills', addressLine2: 'Road No 3', state: 'Telangana', city: 'Hyderabad', pincode: '500033', billAddress: '23 Jubilee Hills', billAddress2: 'Road No 3', billLandmark: 'Opposite Cafe', billCity: 'Hyderabad', billState: 'Telangana', billPinCode: '500033', aadharNum: '381920394810', panNum: 'QRSRT9876C', bankName: 'Axis Bank', gender: 'female', agencyName: 'Vexaro Courier and Cargo', amazonTag: 'na', isActive: true, isBlocked: false, passwordReset: false, createdBy: 'superadmin', profilePhoto: null, role: 'user', createdAt: now - 3 * day, kycStatus: 'pending', kycId: 'k4' },
    { id: 'u5', name: 'Vikram Singh', firstName: 'Vikram', lastName: 'Singh', email: 'vikram@example.com', mobile: '9611223344', address: '56 Park Street', addressLine2: 'Floor 3', state: 'West Bengal', city: 'Kolkata', pincode: '700016', billAddress: '56 Park Street', billAddress2: 'Floor 3', billLandmark: 'Next to Museum', billCity: 'Kolkata', billState: 'West Bengal', billPinCode: '700016', aadharNum: '482910384912', panNum: 'UVWXY1357D', bankName: 'Punjab National Bank', gender: 'male', agencyName: 'Vexaro Courier and Cargo', amazonTag: 'na', isActive: true, isBlocked: false, passwordReset: false, createdBy: 'superadmin', profilePhoto: null, role: 'user', createdAt: now - 1 * day, kycStatus: 'not_started', kycId: null },
  ];

  const placeholderDoc = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='250' viewBox='0 0 400 250'><rect width='400' height='250' fill='#e2e8f0'/><text x='200' y='125' text-anchor='middle' dominant-baseline='middle' font-family='Arial' font-size='18' fill='#94a3b8'>Document Preview</text></svg>`);
  const makeDoc = (name, size) => ({ data: placeholderDoc, name, size, type: 'image/png', uploadedAt: now - Math.floor(Math.random() * 5 * day) });

  const kycRecords = [
    { id: 'k1', userId: 'u1', aadhaarFront: makeDoc('aadhaar_front.png', 420000), aadhaarBack: makeDoc('aadhaar_back.png', 390000), panCard: makeDoc('pan_card.png', 310000), status: 'pending', submittedAt: now - 9 * day, reviewedAt: null, reviewedBy: null, rejectionReason: null, approvedOn: null, timeline: [] },
    { id: 'k2', userId: 'u2', aadhaarFront: makeDoc('aadhaar_front.png', 510000), aadhaarBack: makeDoc('aadhaar_back.png', 480000), panCard: makeDoc('pan_card.png', 340000), status: 'approved', submittedAt: now - 7 * day, reviewedAt: now - 5*day, reviewedBy: 'Admin', rejectionReason: null, approvedOn: now - 5*day, timeline: [] },
    { id: 'k3', userId: 'u3', aadhaarFront: makeDoc('aadhaar_front.png', 450000), aadhaarBack: makeDoc('aadhaar_back.png', 410000), panCard: makeDoc('pan_card.png', 290000), status: 'rejected', submittedAt: now - 4 * day, reviewedAt: now - 2*day, reviewedBy: 'Admin', rejectionReason: 'PAN card image is blurry and unreadable. Please upload a clear, high-resolution image.', approvedOn: null, timeline: [] },
    { id: 'k4', userId: 'u4', aadhaarFront: makeDoc('aadhaar_front.png', 380000), aadhaarBack: makeDoc('aadhaar_back.png', 350000), panCard: makeDoc('pan_card.png', 280000), status: 'pending', submittedAt: now - 2 * day, reviewedAt: null, reviewedBy: null, rejectionReason: null, approvedOn: null, timeline: [] },
  ];

  saveUsers(users);
  saveKYCRecords(kycRecords);
}

/** Initialize storage — seed fallback data only if localStorage is completely empty */
function initStorage() {
  // Only seed demo data if there are truly no users at all
  // Never seed demo data into admin pages; admin data must come from PostgreSQL.
  if (!isAdminPage() && getUsers().length === 0) {
    seedDemoData();
  }
}

// ─── INITIALIZATION ON IMPORT ──────────────────────────────────
initStorage();
if (isAdminPage()) {
  hydrateAdminCacheFromSession();
} else {
  initStorageFromBackend();
}

// User portal: retry offline queue and incremental sync only.
// Admin pages never poll — they load from PostgreSQL on demand to avoid
// overwriting in-flight admin changes with stale database reads.
if (!isAdminPage()) {
  setInterval(() => {
    processOfflineQueue();
    initStorageFromBackend();
  }, 30000);
}
