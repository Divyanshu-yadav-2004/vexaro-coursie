// ============================================================
// storage.js - LocalStorage Data Layer with PostgreSQL Sync
// ============================================================

const USERS_KEY = 'kyc_users';
const KYC_KEY = 'kyc_records';
const ACTIVITY_KEY = 'kyc_activity';

const BACKEND_URL = 'http://localhost:5000/api/sync';

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

async function syncPost(endpoint, payload) {
  if (!payload.updatedAt) payload.updatedAt = Date.now();

  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'Sync failed');
    }
    processOfflineQueue();
  } catch (err) {
    // Queue offline operations
    let queue = [];
    try { queue = JSON.parse(localStorage.getItem('kyc_offline_queue')) || []; } catch {}
    queue.push({ endpoint, payload, timestamp: Date.now() });
    localStorage.setItem('kyc_offline_queue', JSON.stringify(queue));
    showOfflineBanner(true);
  }
}

// ─── INCREMENTAL SYNC & CONFLICT RESOLUTION ───────────────────

async function initStorageFromBackend() {
  const lastSync = Number(localStorage.getItem('kyc_last_sync')) || 0;

  try {
    const res = await fetch(`${BACKEND_URL}?since=${lastSync}`);
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.message || 'Sync request failed');

    showOfflineBanner(false);

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
  } catch (err) {
    console.warn('Backend sync unavailable, using localStorage cache:', err.message);
    showOfflineBanner(true);
  }
}

// ─── User CRUD ───────────────────────────────────────────────

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function idsMatch(a, b) {
  return String(a) === String(b);
}

function getUserById(id) {
  return getUsers().find(u => idsMatch(u.id, id)) || null;
}

function getUserByEmail(email) {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function createUser(userData) {
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
  syncPost('/user', newUser);
  return newUser;
}

function updateUser(id, data) {
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
  syncPost('/user', users[idx]);
  return users[idx];
}

function deleteUser(id) {
  const users = getUsers().filter(u => u.id !== id);
  saveUsers(users);
}

// ─── KYC Records CRUD ────────────────────────────────────────

function getKYCRecords() {
  try { return JSON.parse(localStorage.getItem(KYC_KEY)) || []; }
  catch { return []; }
}

function saveKYCRecords(records) {
  localStorage.setItem(KYC_KEY, JSON.stringify(records));
}

function getKYCByUserId(userId) {
  return getKYCRecords().find(k => idsMatch(k.userId, userId)) || null;
}

function getKYCById(id) {
  return getKYCRecords().find(k => idsMatch(k.id, id)) || null;
}

function createKYC(kycData) {
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
  records.push(newKYC);
  saveKYCRecords(records);

  const user = getUserById(kycData.userId);
  syncPost('/kyc', { ...newKYC, email: user ? user.email : '' });
  return newKYC;
}

function updateKYC(id, data) {
  const records = getKYCRecords();
  const idx = records.findIndex(k => idsMatch(k.id, id));
  if (idx === -1) return null;
  
  records[idx] = { ...records[idx], ...data, updatedAt: Date.now() };
  saveKYCRecords(records);

  const user = getUserById(records[idx].userId);
  syncPost('/kyc', { ...records[idx], email: user ? user.email : '' });
  return records[idx];
}

function deleteKYC(id) {
  saveKYCRecords(getKYCRecords().filter(k => !idsMatch(k.id, id)));
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
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY)) || []; }
  catch { return []; }
}

function saveActivityLogs(logs) {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(logs));
}

function getActivityByUserId(userId) {
  return getActivityLogs().filter(a => idsMatch(a.userId, userId));
}

function logActivity(userId, userName, action, details = {}, icon = '📋') {
  const logs = getActivityLogs();
  const newLog = { id: generateId(), userId, userName, action, timestamp: Date.now(), details, icon };
  logs.unshift(newLog);
  saveActivityLogs(logs.slice(0, 500));
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
  // Never wipe existing user data regardless of schema version
  if (getUsers().length === 0) {
    seedDemoData();
  }
}

// ─── INITIALIZATION ON IMPORT ──────────────────────────────────
initStorage();
initStorageFromBackend();

// Set retry interval loop for offline queues & incremental fetches
setInterval(() => {
  processOfflineQueue();
  initStorageFromBackend();
}, 30000);
