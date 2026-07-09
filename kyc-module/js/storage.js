// ============================================================
// storage.js - LocalStorage Data Layer for Vexaro KYC Portal
// ============================================================

const USERS_KEY = 'kyc_users';
const KYC_KEY = 'kyc_records';
const ACTIVITY_KEY = 'kyc_activity';

// User object:
// { id, name, firstName, lastName, email, mobile, address, city, state, pincode, gender, agencyName, amazonTag, isActive, isBlocked, passwordReset, createdBy, profilePhoto (base64|null), role ('user'|'admin'), createdAt, kycStatus ('not_started'|'pending'|'approved'|'rejected'), kycId (null|string) }

// KYC Record object:
// { id, userId, aadhaarFront: {data, name, size, type, uploadedAt}, aadhaarBack: {same}, panCard: {same}, status ('pending'|'approved'|'rejected'), submittedAt, reviewedAt, reviewedBy, rejectionReason, approvedOn, timeline: [{step, completedAt, status}] }

// Activity Log entry:
// { id, userId, userName, action, timestamp, details, icon }

// ─── User CRUD ───────────────────────────────────────────────

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getUserById(id) {
  return getUsers().find(u => u.id === id) || null;
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
    kycStatus: 'not_started',
    kycId: null,
    ...userData
  };
  users.push(newUser);
  saveUsers(users);
  return newUser;
}

function updateUser(id, data) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;

  // If name is updated, split it again into firstName and lastName
  if (data.name !== undefined) {
    const nameParts = (data.name || '').trim().split(' ');
    data.firstName = nameParts[0] || '';
    data.lastName = nameParts.slice(1).join(' ') || '';
  }

  users[idx] = { ...users[idx], ...data };
  saveUsers(users);
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
  return getKYCRecords().find(k => k.userId === userId) || null;
}

function getKYCById(id) {
  return getKYCRecords().find(k => k.id === id) || null;
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
    timeline: kycData.timeline || []
  };
  records.push(newKYC);
  saveKYCRecords(records);
  return newKYC;
}

function updateKYC(id, data) {
  const records = getKYCRecords();
  const idx = records.findIndex(k => k.id === id);
  if (idx === -1) return null;
  records[idx] = { ...records[idx], ...data };
  saveKYCRecords(records);
  return records[idx];
}

function deleteKYC(id) {
  saveKYCRecords(getKYCRecords().filter(k => k.id !== id));
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
  return getActivityLogs().filter(a => a.userId === userId);
}

function logActivity(userId, userName, action, details = {}, icon = '📋') {
  const logs = getActivityLogs();
  logs.unshift({ id: generateId(), userId, userName, action, timestamp: Date.now(), details, icon });
  // Keep last 500 entries
  saveActivityLogs(logs.slice(0, 500));
}

function getRecentActivity(limit = 10) {
  return getActivityLogs().slice(0, limit);
}

// ─── Demo Data Seeder ─────────────────────────────────────────

function seedDemoData() {
  if (getUsers().length > 0) return; // Already seeded

  const now = Date.now();
  const day = 86400000;

  // Demo users
  const users = [
    { 
      id: 'u1', 
      name: 'Rahul Sharma', 
      firstName: 'Rahul', 
      lastName: 'Sharma', 
      email: 'rahul@example.com', 
      mobile: '9876543210', 
      address: '12 MG Road', 
      addressLine2: 'Near High School',
      state: 'Maharashtra',
      city: 'Mumbai', 
      pincode: '400001',
      billAddress: '12 MG Road',
      billAddress2: 'Near High School',
      billLandmark: 'Opposite Police Station',
      billCity: 'Mumbai',
      billState: 'Maharashtra',
      billPinCode: '400001',
      aadharNum: '592810483920',
      panNum: 'ABCDE1234F',
      bankName: 'State Bank of India',
      gender: 'male', 
      agencyName: 'Vexaro Courier and Cargo', 
      amazonTag: 'na', 
      isActive: true, 
      isBlocked: false, 
      passwordReset: false, 
      createdBy: 'superadmin', 
      profilePhoto: null, 
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
      addressLine2: 'Sector 4',
      state: 'Gujarat',
      city: 'Ahmedabad', 
      pincode: '380001',
      billAddress: '45 Nehru Nagar',
      billAddress2: 'Sector 4',
      billLandmark: 'Opposite Garden',
      billCity: 'Ahmedabad',
      billState: 'Gujarat',
      billPinCode: '380001',
      aadharNum: '918204938201',
      panNum: 'XYZPQ5678A',
      bankName: 'HDFC Bank',
      gender: 'female', 
      agencyName: 'Velocity Logistics', 
      amazonTag: 'vlc101', 
      isActive: true, 
      isBlocked: false, 
      passwordReset: false, 
      createdBy: 'superadmin', 
      profilePhoto: null, 
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
      addressLine2: 'Mall Road',
      state: 'Delhi',
      city: 'New Delhi', 
      pincode: '110001',
      billAddress: '7 Civil Lines',
      billAddress2: 'Mall Road',
      billLandmark: 'Near City Metro',
      billCity: 'New Delhi',
      billState: 'Delhi',
      billPinCode: '110001',
      aadharNum: '782910384910',
      panNum: 'LMNOP2468B',
      bankName: 'ICICI Bank',
      gender: 'male', 
      agencyName: 'Raza Courier And Cargo', 
      amazonTag: 'na', 
      isActive: true, 
      isBlocked: false, 
      passwordReset: false, 
      createdBy: 'superadmin', 
      profilePhoto: null, 
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
      addressLine2: 'Road No 3',
      state: 'Telangana',
      city: 'Hyderabad', 
      pincode: '500033',
      billAddress: '23 Jubilee Hills',
      billAddress2: 'Road No 3',
      billLandmark: 'Opposite Cafe',
      billCity: 'Hyderabad',
      billState: 'Telangana',
      billPinCode: '500033',
      aadharNum: '381920394810',
      panNum: 'QRSRT9876C',
      bankName: 'Axis Bank',
      gender: 'female', 
      agencyName: 'Vexaro Courier and Cargo', 
      amazonTag: 'na', 
      isActive: true, 
      isBlocked: false, 
      passwordReset: false, 
      createdBy: 'superadmin', 
      profilePhoto: null, 
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
      addressLine2: 'Floor 3',
      state: 'West Bengal',
      city: 'Kolkata', 
      pincode: '700016',
      billAddress: '56 Park Street',
      billAddress2: 'Floor 3',
      billLandmark: 'Next to Museum',
      billCity: 'Kolkata',
      billState: 'West Bengal',
      billPinCode: '700016',
      aadharNum: '482910384912',
      panNum: 'UVWXY1357D',
      bankName: 'Punjab National Bank',
      gender: 'male', 
      agencyName: 'Vexaro Courier and Cargo', 
      amazonTag: 'na', 
      isActive: true, 
      isBlocked: false, 
      passwordReset: false, 
      createdBy: 'superadmin', 
      profilePhoto: null, 
      role: 'user', 
      createdAt: now - 1 * day, 
      kycStatus: 'not_started', 
      kycId: null 
    },
  ];

  const placeholderDoc = 'data:image/svg+xml;base64,' + btoa(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='250' viewBox='0 0 400 250'><rect width='400' height='250' fill='#e2e8f0'/><text x='200' y='125' text-anchor='middle' dominant-baseline='middle' font-family='Arial' font-size='18' fill='#94a3b8'>Document Preview</text></svg>`);
  const makeDoc = (name, size) => ({ data: placeholderDoc, name, size, type: 'image/png', uploadedAt: now - Math.floor(Math.random() * 5 * day) });

  const kycRecords = [
    { id: 'k1', userId: 'u1', aadhaarFront: makeDoc('aadhaar_front.png', 420000), aadhaarBack: makeDoc('aadhaar_back.png', 390000), panCard: makeDoc('pan_card.png', 310000), status: 'pending', submittedAt: now - 9 * day, reviewedAt: null, reviewedBy: null, rejectionReason: null, approvedOn: null, timeline: buildTimeline('pending', now - 10*day, now - 9*day) },
    { id: 'k2', userId: 'u2', aadhaarFront: makeDoc('aadhaar_front.png', 510000), aadhaarBack: makeDoc('aadhaar_back.png', 480000), panCard: makeDoc('pan_card.png', 340000), status: 'approved', submittedAt: now - 7 * day, reviewedAt: now - 5*day, reviewedBy: 'Admin', rejectionReason: null, approvedOn: now - 5*day, timeline: buildTimeline('approved', now - 8*day, now - 7*day, now - 5*day) },
    { id: 'k3', userId: 'u3', aadhaarFront: makeDoc('aadhaar_front.png', 450000), aadhaarBack: makeDoc('aadhaar_back.png', 410000), panCard: makeDoc('pan_card.png', 290000), status: 'rejected', submittedAt: now - 4 * day, reviewedAt: now - 2*day, reviewedBy: 'Admin', rejectionReason: 'PAN card image is blurry and unreadable. Please upload a clear, high-resolution image.', approvedOn: null, timeline: buildTimeline('rejected', now - 5*day, now - 4*day, now - 2*day) },
    { id: 'k4', userId: 'u4', aadhaarFront: makeDoc('aadhaar_front.png', 380000), aadhaarBack: makeDoc('aadhaar_back.png', 350000), panCard: makeDoc('pan_card.png', 280000), status: 'pending', submittedAt: now - 2 * day, reviewedAt: null, reviewedBy: null, rejectionReason: null, approvedOn: null, timeline: buildTimeline('pending', now - 3*day, now - 2*day) },
  ];

  function buildTimeline(status, createdAt, submittedAt, reviewedAt) {
    const steps = [
      { step: 'Profile Completed', completedAt: createdAt, status: 'completed' },
      { step: 'Documents Uploaded', completedAt: submittedAt - 3600000, status: 'completed' },
      { step: 'Review Completed', completedAt: submittedAt - 1800000, status: 'completed' },
      { step: 'KYC Submitted', completedAt: submittedAt, status: 'completed' },
      { step: 'Under Verification', completedAt: status !== 'pending' ? (reviewedAt || null) : null, status: status !== 'pending' ? 'completed' : 'active' },
      { step: status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Awaiting Decision', completedAt: reviewedAt || null, status: (status === 'approved' || status === 'rejected') ? 'completed' : 'pending' },
    ];
    return steps;
  }

  saveUsers(users);
  saveKYCRecords(kycRecords);

  // Seed activity logs
  const activities = [
    { id: generateId(), userId: 'u1', userName: 'Rahul Sharma', action: 'Submitted KYC for verification', timestamp: now - 9*day, details: {}, icon: '📤' },
    { id: generateId(), userId: 'u1', userName: 'Rahul Sharma', action: 'Uploaded PAN Card', timestamp: now - 9*day - 1000000, details: {}, icon: '💳' },
    { id: generateId(), userId: 'u1', userName: 'Rahul Sharma', action: 'Uploaded Aadhaar Back', timestamp: now - 9*day - 2000000, details: {}, icon: '📋' },
    { id: generateId(), userId: 'u1', userName: 'Rahul Sharma', action: 'Uploaded Aadhaar Front', timestamp: now - 9*day - 3000000, details: {}, icon: '📋' },
    { id: generateId(), userId: 'u1', userName: 'Rahul Sharma', action: 'Created profile', timestamp: now - 10*day, details: {}, icon: '👤' },
    { id: generateId(), userId: 'u2', userName: 'Priya Patel', action: 'KYC Approved by Admin', timestamp: now - 5*day, details: {}, icon: '✅' },
    { id: generateId(), userId: 'u2', userName: 'Priya Patel', action: 'Submitted KYC for verification', timestamp: now - 7*day, details: {}, icon: '📤' },
    { id: generateId(), userId: 'u3', userName: 'Amit Kumar', action: 'KYC Rejected by Admin', timestamp: now - 2*day, details: { reason: 'PAN image blurry' }, icon: '❌' },
    { id: generateId(), userId: 'u3', userName: 'Amit Kumar', action: 'Submitted KYC for verification', timestamp: now - 4*day, details: {}, icon: '📤' },
    { id: generateId(), userId: 'u4', userName: 'Sneha Reddy', action: 'Submitted KYC for verification', timestamp: now - 2*day, details: {}, icon: '📤' },
  ];
  saveActivityLogs(activities);
}

/** Initialize storage — seed and migrate schema if needed */
function initStorage() {
  const users = getUsers();
  // Migration check: Clear old demo data if it doesn't support Aadhar/PAN fields
  if (users.length > 0 && !users[0].aadharNum) {
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(KYC_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
  }
  seedDemoData();
}
