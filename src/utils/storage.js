// ============================================================
// storage.js - LocalStorage & Redaction Layer for Vexaro React
// ============================================================

const USERS_KEY = 'vexaro_users';
const KYC_KEY = 'vexaro_records';
const SESSION_KEY = 'vexaro_session';

// ─── REDACTION / SECURITY UTILITIES ──────────────────────────
export function redactFileName(name, type = 'document') {
  if (!name) return `unnamed_${type}_redacted.pdf`;
  const dotIndex = name.lastIndexOf('.');
  const ext = dotIndex !== -1 ? name.substring(dotIndex) : '.pdf';
  const base = dotIndex !== -1 ? name.substring(0, dotIndex) : name;
  return `${base.toLowerCase().replace(/[^a-z0-9]/g, '_')}_redacted${ext}`;
}

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
  return `${text.slice(0, 3)}... [REDACTED FOR SECURITY]`;
}

// ─── INITIAL DEMO DATA SEEDING ───────────────────────────────
export function initStorage() {
  if (localStorage.getItem(USERS_KEY)) return; // Already seeded

  const now = Date.now();
  const day = 86400000;

  // Seed standard clients, admins, owners
  const demoUsers = [
    { 
      id: 'u1', 
      name: 'Rahul Sharma', 
      firstName: 'Rahul', 
      lastName: 'Sharma', 
      email: 'rahul@example.com', 
      mobile: '9876543210', 
      address: '12 MG Road', 
      city: 'Mumbai', 
      state: 'Maharashtra', 
      pincode: '400001', 
      gender: 'male', 
      agencyName: 'Vexaro Courier & Cargo',
      role: 'user', 
      createdAt: now - 10 * day, 
      kycStatus: 'pending', 
      kycId: 'k1' 
    },
    { 
      id: 'u2', 
      name: 'Priya Patel', 
      firstName: 'Priya', 
      lastName: 'Patel', 
      email: 'priya@example.com', 
      mobile: '9845678901', 
      address: '45 Nehru Nagar', 
      city: 'Ahmedabad', 
      state: 'Gujarat', 
      pincode: '380001', 
      gender: 'female', 
      agencyName: 'Velocity Logistics',
      role: 'user', 
      createdAt: now - 8 * day, 
      kycStatus: 'approved', 
      kycId: 'k2' 
    },
    { 
      id: 'u3', 
      name: 'Amit Kumar', 
      firstName: 'Amit', 
      lastName: 'Kumar', 
      email: 'amit@example.com', 
      mobile: '9712345678', 
      address: '7 Civil Lines', 
      city: 'New Delhi', 
      state: 'Delhi', 
      pincode: '110001', 
      gender: 'male', 
      agencyName: 'Raza Courier And Cargo',
      role: 'user', 
      createdAt: now - 5 * day, 
      kycStatus: 'rejected', 
      kycId: 'k3' 
    },
    { 
      id: 'u4', 
      name: 'Sneha Reddy', 
      firstName: 'Sneha', 
      lastName: 'Reddy', 
      email: 'sneha@example.com', 
      mobile: '9988776655', 
      address: '23 Jubilee Hills', 
      city: 'Hyderabad', 
      state: 'Telangana', 
      pincode: '500033', 
      gender: 'female', 
      agencyName: 'Vexaro Courier & Cargo',
      role: 'user', 
      createdAt: now - 3 * day, 
      kycStatus: 'pending', 
      kycId: 'k4' 
    },
    { 
      id: 'u5', 
      name: 'Vikram Singh', 
      firstName: 'Vikram', 
      lastName: 'Singh', 
      email: 'vikram@example.com', 
      mobile: '9611223344', 
      address: '56 Park Street', 
      city: 'Kolkata', 
      state: 'West Bengal', 
      pincode: '700016', 
      gender: 'male', 
      agencyName: 'Vexaro Courier & Cargo',
      role: 'user', 
      createdAt: now - 1 * day, 
      kycStatus: 'not_started', 
      kycId: null 
    },
    {
      id: 'admin1',
      name: 'System Admin',
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@kycportal.com',
      mobile: '9999999999',
      role: 'admin',
      createdAt: now - 30 * day,
      kycStatus: 'approved'
    },
    {
      id: 'owner1',
      name: 'Senior Partner (Owner)',
      firstName: 'Senior',
      lastName: 'Partner',
      email: 'owner@kycportal.com',
      mobile: '8888888888',
      role: 'owner',
      createdAt: now - 45 * day,
      kycStatus: 'approved'
    }
  ];

  const makeDoc = (name, size) => ({
    name: name,
    size: size,
    type: 'image/png',
    uploadedAt: now - 5 * day
  });

  const demoKYCRecords = [
    { 
      id: 'k1', 
      userId: 'u1', 
      aadhaarFront: makeDoc('aadhaar_front.png', '420 KB'), 
      aadhaarBack: makeDoc('aadhaar_back.png', '390 KB'), 
      panCard: makeDoc('pan_card.png', '310 KB'), 
      status: 'pending', 
      submittedAt: now - 9 * day 
    },
    { 
      id: 'k2', 
      userId: 'u2', 
      aadhaarFront: makeDoc('national_id_front.png', '510 KB'), 
      aadhaarBack: makeDoc('national_id_back.png', '480 KB'), 
      panCard: makeDoc('pan_card_final.png', '340 KB'), 
      status: 'approved', 
      submittedAt: now - 7 * day 
    },
    { 
      id: 'k3', 
      userId: 'u3', 
      aadhaarFront: makeDoc('my_aadhaar_front.png', '450 KB'), 
      aadhaarBack: makeDoc('my_aadhaar_back.png', '410 KB'), 
      panCard: makeDoc('pan_card_blurry.png', '290 KB'), 
      status: 'rejected', 
      submittedAt: now - 4 * day,
      rejectionReason: 'PAN card image is blurry and unreadable. Please upload a clear image.' 
    },
    { 
      id: 'k4', 
      userId: 'u4', 
      aadhaarFront: makeDoc('aadhaar_f.jpg', '380 KB'), 
      aadhaarBack: makeDoc('aadhaar_b.jpg', '350 KB'), 
      panCard: makeDoc('pan.jpg', '280 KB'), 
      status: 'pending', 
      submittedAt: now - 2 * day 
    }
  ];

  localStorage.setItem(USERS_KEY, JSON.stringify(demoUsers));
  localStorage.setItem(KYC_KEY, JSON.stringify(demoKYCRecords));
}

// ─── DATA ACCESSORS ──────────────────────────────────────────
export function getUsers() {
  initStorage();
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch { return []; }
}

export function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getKYCRecords() {
  initStorage();
  try { return JSON.parse(localStorage.getItem(KYC_KEY)) || []; }
  catch { return []; }
}

export function saveKYCRecords(records) {
  localStorage.setItem(KYC_KEY, JSON.stringify(records));
}

export function getKYCByUserId(userId) {
  return getKYCRecords().find(k => k.userId === userId) || null;
}

export function updateKYCRecord(userId, kycData) {
  const records = getKYCRecords();
  const idx = records.findIndex(k => k.userId === userId);
  const now = Date.now();
  
  const updatedRecord = {
    userId,
    aadhaarFront: kycData.aadhaarFront || null,
    aadhaarBack: kycData.aadhaarBack || null,
    panCard: kycData.panCard || null,
    status: kycData.status || 'pending',
    submittedAt: now,
    ...kycData
  };

  if (idx === -1) {
    updatedRecord.id = 'k_' + Math.random().toString(36).substr(2, 9);
    records.push(updatedRecord);
  } else {
    records[idx] = { ...records[idx], ...updatedRecord };
  }

  saveKYCRecords(records);
  
  // Also update user's kycStatus and kycId
  const users = getUsers();
  const uIdx = users.findIndex(u => u.id === userId);
  if (uIdx !== -1) {
    users[uIdx].kycStatus = updatedRecord.status;
    users[uIdx].kycId = updatedRecord.id;
    saveUsers(users);
  }

  return updatedRecord;
}

export function updateUserProfile(userId, profileData) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return null;

  users[idx] = { ...users[idx], ...profileData };
  saveUsers(users);
  return users[idx];
}

// ─── SIMULATED SESSION MANAGEMENT ────────────────────────────
export function getSession() {
  initStorage();
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
  catch { return null; }
}

export function login(email) {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
  }
  return null;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}
