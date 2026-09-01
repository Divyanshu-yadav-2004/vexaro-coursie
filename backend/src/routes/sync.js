const express = require('express');
const pool = require('../db');
const { sendKycApprovedWhatsApp } = require('../services/whatsapp');
const { sendKycApprovedEmail, sendKycRejectedEmail } = require('../services/email');
const router = express.Router();


// Helper for consistent error responses
function fail(res, code, message, details = null) {
  return res.status(code).json({
    success: false,
    message: message,
    ...(details ? { details } : {})
  });
}

// Helper for consistent success responses
function success(res, message, data = {}) {
  return res.status(200).json({
    success: true,
    message: message,
    data: data
  });
}

function summarizeKycPayload(k = {}) {
  return {
    id: k.id,
    userId: k.userId,
    email: k.email,
    status: k.status,
    submittedAt: k.submittedAt,
    updatedAt: k.updatedAt,
    documents: {
      aadhaarFront: Boolean(k.aadhaarFront),
      aadhaarBack: Boolean(k.aadhaarBack),
      panCard: Boolean(k.panCard),
      passbookPhoto: Boolean(k.passbookPhoto)
    }
  };
}

function summarizeUserPayload(u = {}) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    kycStatus: u.kycStatus,
    updatedAt: u.updatedAt
  };
}

// Helper: Validate email format
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// Helper: Validate PAN format
function isValidPan(pan) {
  const re = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return re.test(String(pan).toUpperCase());
}

// Helper: Validate Aadhaar format (exactly 12 digits)
function isValidAadhar(aadhar) {
  const re = /^\d{12}$/;
  return re.test(String(aadhar));
}

// Helper: Validate Mobile format (at least 10 digits numeric)
function isValidMobile(mobile) {
  const re = /^\d{10}$/;
  return re.test(String(mobile));
}

function normalizePan(pan) {
  if (!pan) return null;
  return String(pan).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeDigits(value) {
  if (!value) return null;
  return String(value).replace(/\D/g, '');
}

// ─── GET /api/sync ────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { since } = req.query;
  const now = Date.now();
  const CLOCK_SKEW_BUFFER_MS = 60 * 1000; // 1 minute buffer for clock skew

  let sinceMs = 0;
  let isFullSync = false;
  let syncReason = 'valid_incremental';

  // ── 1. Validate `since` parameter ──────────────────────────
  if (since === undefined || since === null || since === '') {
    isFullSync = true;
    syncReason = 'since_missing';
  } else {
    const parsed = Number(since);
    if (isNaN(parsed)) {
      isFullSync = true;
      syncReason = 'since_nan';
    } else if (parsed <= 0) {
      isFullSync = true;
      syncReason = 'since_zero_or_negative';
    } else if (parsed > now + CLOCK_SKEW_BUFFER_MS) {
      isFullSync = true;
      syncReason = `since_future_timestamp (received: ${parsed}, serverNow: ${now})`;
    } else {
      sinceMs = parsed;
    }
  }

  // Track query context for error logging
  let _queryStage = 'init';
  let _usersQuery = '';
  let _kycQuery = '';
  let _activityQuery = '';

  try {
    console.log('[sync:get] request received', {
      receivedSince: since !== undefined ? since : null,
      parsedSinceMs: sinceMs,
      syncType: isFullSync ? 'FULL' : 'INCREMENTAL',
      syncReason: syncReason,
      serverTime: now,
      database: process.env.DATABASE_URL ? 'DATABASE_URL configured' : (process.env.DB_NAME || 'vexaro_kyc')
    });

    let usersQuery, kycQuery, activityQuery;

    if (!isFullSync && sinceMs > 0) {
      // ── Incremental sync ─────────────────────────────────────
      const sinceDate = new Date(sinceMs);

      usersQuery    = 'SELECT * FROM users WHERE updated_at > $1 OR created_at > $1 ORDER BY id ASC';
      kycQuery      = 'SELECT * FROM kyc_records WHERE updated_at > $1 OR submitted_at > $1 OR created_at > $1 ORDER BY id ASC';
      activityQuery = 'SELECT * FROM activity_logs WHERE timestamp > $1 OR created_at > $2 ORDER BY timestamp DESC';

      _usersQuery    = usersQuery;
      _kycQuery      = kycQuery;
      _activityQuery = activityQuery;

      _queryStage = 'parallel-queries (incremental)';
      const [usersRes, kycRes, activityRes] = await Promise.all([
        pool.query(usersQuery,    [sinceDate]),
        pool.query(kycQuery,      [sinceDate]),
        pool.query(activityQuery, [sinceMs, sinceDate])
      ]);

      return _buildAndSendSyncResponse(res, usersRes, kycRes, activityRes, since, sinceMs, false, syncReason, now);
    } else {
      // ── Full sync ─────────────────────────────────────────────
      usersQuery    = 'SELECT * FROM users ORDER BY id ASC';
      kycQuery      = 'SELECT * FROM kyc_records ORDER BY id ASC';
      activityQuery = 'SELECT * FROM activity_logs ORDER BY timestamp DESC';

      _usersQuery    = usersQuery;
      _kycQuery      = kycQuery;
      _activityQuery = activityQuery;

      _queryStage = 'parallel-queries (full sync)';
      const [usersRes, kycRes, activityRes] = await Promise.all([
        pool.query(usersQuery),
        pool.query(kycQuery),
        pool.query(activityQuery)
      ]);

      return _buildAndSendSyncResponse(res, usersRes, kycRes, activityRes, since, 0, true, syncReason, now);
    }

  } catch (err) {
    console.error('[sync:get] FAILED — stage:', _queryStage, '| error code:', err.code, '| message:', err.message);
    console.error('[sync:get] queries at failure:', { users: _usersQuery, kyc: _kycQuery, activity: _activityQuery });
    console.error('[sync:get] full stack:', err.stack || err);
    return fail(res, 500, 'Database error during sync', {
      stage: _queryStage,
      code: err.code || null,
      detail: err.message || null
    });
  }
});

// ─── Helper: build and send the sync JSON response ────────────
function _buildAndSendSyncResponse(res, usersRes, kycRes, activityRes, rawSince, sinceMs, isFullSync, syncReason, serverTime) {
  // Map database records back to the frontend objects format
  const users = usersRes.rows.map(u => ({
    id: u.role === 'admin' ? 'admin1' : u.role === 'owner' ? 'owner1' : 'u' + u.id,
    name: u.name || (u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.email),
    firstName: u.first_name || '',
    lastName: u.last_name || '',
    email: u.email,
    mobile: u.mobile || '',
    address: u.address_line1,
    addressLine2: u.address_line2,
    state: u.state,
    city: u.city,
    pincode: u.pincode,
    billAddress: u.billing_address_line1,
    billAddress2: u.billing_address_line2,
    billLandmark: u.bill_landmark,
    billCity: u.bill_city,
    billState: u.bill_state,
    billPinCode: u.bill_pincode,
    aadharNum: u.aadhar_num,
    panNum: u.pan_num,
    bankName: u.bank_name,
    gender: u.gender,
    agencyName: u.agency_name,
    amazonTag: u.amazon_tag,
    isActive: u.is_active,
    isBlocked: u.is_blocked,
    passwordReset: u.password_reset,
    createdBy: u.created_by,
    profilePhoto: u.profile_photo,
    role: u.role,
    kycStatus: u.kyc_status,
    kycId: u.role === 'user' ? 'k' + u.id : null,
    createdAt: u.created_at ? new Date(u.created_at).getTime() : Date.now(),
    updatedAt: u.updated_at ? new Date(u.updated_at).getTime() : Date.now()
  }));

  const records = kycRes.rows.map(k => ({
    id: 'k' + k.user_id,
    userId: 'u' + k.user_id,
    status: k.status,
    rejectionReason: k.rejection_reason,
    submittedAt: k.submitted_at ? new Date(k.submitted_at).getTime() : Date.now(),
    reviewedAt: k.reviewed_at ? new Date(k.reviewed_at).getTime() : null,
    reviewedBy: k.reviewed_by ? 'Admin' : null,
    aadhaarFront: k.aadhaar_front_name ? {
      data: k.aadhaar_front_data,
      name: k.aadhaar_front_name,
      size: k.aadhaar_front_size,
      type: 'image/png'
    } : null,
    aadhaarBack: k.aadhaar_back_name ? {
      data: k.aadhaar_back_data,
      name: k.aadhaar_back_name,
      size: k.aadhaar_back_size,
      type: 'image/png'
    } : null,
    panCard: k.pan_card_name ? {
      data: k.pan_card_data,
      name: k.pan_card_name,
      size: k.pan_card_size,
      type: 'image/png'
    } : null,
    passbookPhoto: k.passbook_photo_name ? {
      data: k.passbook_photo_data,
      name: k.passbook_photo_name,
      size: k.passbook_photo_size,
      type: 'image/png'
    } : null,
    timeline: [
      { step: 'Profile Completed',  completedAt: k.submitted_at ? new Date(k.submitted_at).getTime() - 86400000 : Date.now() - 86400000, status: 'completed' },
      { step: 'Documents Uploaded', completedAt: k.submitted_at ? new Date(k.submitted_at).getTime() - 3600000  : Date.now() - 3600000,  status: 'completed' },
      { step: 'Review Completed',   completedAt: k.submitted_at ? new Date(k.submitted_at).getTime() - 1800000  : Date.now() - 1800000,  status: 'completed' },
      { step: 'KYC Submitted',      completedAt: k.submitted_at ? new Date(k.submitted_at).getTime()            : Date.now(),            status: 'completed' },
      { step: 'Under Verification', completedAt: k.status !== 'pending' ? (k.reviewed_at ? new Date(k.reviewed_at).getTime() : null) : null, status: k.status !== 'pending' ? 'completed' : 'active' },
      { step: k.status === 'approved' ? 'Approved' : k.status === 'rejected' ? 'Rejected' : 'Awaiting Decision', completedAt: k.reviewed_at ? new Date(k.reviewed_at).getTime() : null, status: (k.status === 'approved' || k.status === 'rejected') ? 'completed' : 'pending' }
    ],
    updatedAt: k.updated_at ? new Date(k.updated_at).getTime() : Date.now()
  }));

  const activities = activityRes.rows.map(row => {
    let details = {};
    if (row.details) {
      if (typeof row.details === 'object') {
        details = row.details;
      } else {
        try {
          details = JSON.parse(row.details);
        } catch (parseErr) {
          console.warn('[sync:get] activity_logs row id=' + row.id + ' has unparseable details:', parseErr.message);
        }
      }
    }
    return {
      id: 'act_' + row.id,
      userId: row.user_id,
      userName: row.user_name,
      action: row.action,
      timestamp: Number(row.timestamp),
      details,
      icon: row.icon
    };
  });

  console.log('[sync:get] sync complete', {
    receivedSince: rawSince !== undefined ? rawSince : null,
    syncType: isFullSync ? 'FULL' : 'INCREMENTAL',
    syncReason: syncReason,
    returnedCounts: {
      users: users.length,
      kycRecords: records.length,
      activities: activities.length
    },
    finalSyncTimestamp: serverTime
  });
  const responsePayload = {
    success: true,
    syncType: isFullSync ? 'FULL' : 'INCREMENTAL',
    syncReason: syncReason,
    serverTime: serverTime,
    users,
    records,
    activities
  };

  return res.json(responsePayload);
}


// ─── POST /api/sync/user ──────────────────────────────────────
router.post('/user', async (req, res) => {
  const u = req.body;
  console.log('[sync:user] incoming request', summarizeUserPayload(u));

  if (u.email) u.email = String(u.email).trim().toLowerCase();
  if (u.mobile) u.mobile = normalizeDigits(u.mobile);
  if (u.aadharNum) u.aadharNum = normalizeDigits(u.aadharNum);
  if (u.panNum) u.panNum = normalizePan(u.panNum);

  // Validation
  if (!u.email) return fail(res, 400, 'Email address is required');
  if (!isValidEmail(u.email)) return fail(res, 400, 'Invalid email format');
  if (u.mobile && !isValidMobile(u.mobile)) return fail(res, 400, 'Mobile must be 10 digits');
  if (u.aadharNum && !isValidAadhar(u.aadharNum)) return fail(res, 400, 'Aadhaar must be exactly 12 digits');
  if (u.panNum && !isValidPan(u.panNum)) return fail(res, 400, 'Invalid PAN format');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user already exists by email OR mobile
    let findRes;
    const cleanEmail = u.email.toLowerCase();
    const cleanMobile = u.mobile ? normalizeDigits(u.mobile) : null;

    if (cleanMobile) {
      findRes = await client.query(
        'SELECT id, email, mobile, kyc_status, updated_at FROM users WHERE email = $1 OR (mobile IS NOT NULL AND mobile = $2) ORDER BY id ASC',
        [cleanEmail, cleanMobile]
      );
    } else {
      findRes = await client.query(
        'SELECT id, email, mobile, kyc_status, updated_at FROM users WHERE email = $1',
        [cleanEmail]
      );
    }

    let userResult;
    if (findRes.rows.length > 0) {
      const dbUser = findRes.rows[0];
      const dbUpdatedAt = new Date(dbUser.updated_at).getTime();
      const clientUpdatedAt = u.updatedAt ? Number(u.updatedAt) : 0;

      if (clientUpdatedAt > 0 && dbUpdatedAt > clientUpdatedAt) {
        await client.query('COMMIT');
        console.log('[sync:user] skipped older client payload', {
          email: u.email,
          dbUserId: dbUser.id,
          dbUpdatedAt,
          clientUpdatedAt
        });
        return success(res, 'DB has newer version, skip update', { skipped: true, user: dbUser });
      }

      // Update existing user by ID (using COALESCE to preserve existing non-null database fields)
      userResult = await client.query(
        `UPDATE users
         SET name                  = COALESCE($1, name),
             first_name            = COALESCE($2, first_name),
             last_name             = COALESCE($3, last_name),
             mobile                = COALESCE($4, mobile),
             gender                = COALESCE($5, gender),
             agency_name           = COALESCE($6, agency_name),
             address_line1         = COALESCE($7, address_line1),
             address_line2         = COALESCE($8, address_line2),
             city                  = COALESCE($9, city),
             state                 = COALESCE($10, state),
             pincode               = COALESCE($11, pincode),
             billing_address_line1 = COALESCE($12, billing_address_line1),
             billing_address_line2 = COALESCE($13, billing_address_line2),
             profile_photo         = COALESCE($14, profile_photo),
             kyc_status            = COALESCE($15, kyc_status),
             aadhar_num            = COALESCE($16, aadhar_num),
             pan_num               = COALESCE($17, pan_num),
             bank_name             = COALESCE($18, bank_name),
             bill_landmark         = COALESCE($19, bill_landmark),
             bill_city             = COALESCE($20, bill_city),
             bill_state            = COALESCE($21, bill_state),
             bill_pincode          = COALESCE($22, bill_pincode),
             amazon_tag            = COALESCE($23, amazon_tag),
             is_active             = COALESCE($24, is_active),
             is_blocked            = COALESCE($25, is_blocked),
             password_reset        = COALESCE($26, password_reset),
             created_by            = COALESCE($27, created_by),
             updated_at            = NOW()
         WHERE id = $28
         RETURNING *`,
        [
          u.name || null, u.firstName || null, u.lastName || null, cleanMobile || null,
          u.gender || null, u.agencyName || null, u.address || null, u.addressLine2 || null,
          u.city || null, u.state || null, u.pincode || null,
          u.billAddress || null, u.billAddress2 || null,
          u.profilePhoto || null, u.kycStatus || null, u.aadharNum || null, u.panNum || null, u.bankName || null,
          u.billLandmark || null, u.billCity || null, u.billState || null, u.billPinCode || null,
          u.amazonTag || null,
          u.isActive !== undefined ? u.isActive : null,
          u.isBlocked !== undefined ? u.isBlocked : null,
          u.passwordReset !== undefined ? u.passwordReset : null,
          u.createdBy || null,
          dbUser.id
        ]
      );
    } else {
      // Insert new user (default password is hash of 'admin@kyc123')
      const defaultHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
      const role = (u.email.toLowerCase().includes('admin') || u.role === 'admin') ? 'admin' : (u.email.toLowerCase().includes('owner') || u.role === 'owner') ? 'owner' : 'user';
      userResult = await client.query(
        `INSERT INTO users
          (name, first_name, last_name, email, password_hash, mobile, role, gender, agency_name,
           address_line1, address_line2, city, state, pincode, billing_address_line1, billing_address_line2,
           profile_photo, kyc_status, aadhar_num, pan_num, bank_name, bill_landmark, bill_city, bill_state, bill_pincode,
           amazon_tag, is_active, is_blocked, password_reset, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
         RETURNING *`,
        [
          u.name, u.firstName, u.lastName, cleanEmail, defaultHash, cleanMobile, role, u.gender || 'male', u.agencyName,
          u.address, u.addressLine2, u.city, u.state, u.pincode, u.billAddress, u.billAddress2,
          u.profilePhoto, u.kycStatus || 'not_started', u.aadharNum, u.panNum, u.bankName, u.billLandmark, u.billCity, u.billState, u.billPinCode,
          u.amazonTag || 'na', u.isActive !== false, u.isBlocked === true, u.passwordReset === true, u.createdBy || 'superadmin'
        ]
      );
    }

    console.log('[sync:user] database write result', {
      rowCount: userResult.rowCount,
      id: userResult.rows[0]?.id,
      email: userResult.rows[0]?.email,
      kycStatus: userResult.rows[0]?.kyc_status
    });

    await client.query('COMMIT');
    console.log('[sync:user] transaction committed', {
      id: userResult.rows[0]?.id,
      email: userResult.rows[0]?.email
    });
    return success(res, 'User synced successfully', userResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Sync user error:', err);
    return fail(res, 500, 'Database error during user sync');
  } finally {
    client.release();
  }
});

// ─── POST /api/sync/kyc ───────────────────────────────────────
router.post('/kyc', async (req, res) => {
  const k = req.body;
  console.log('[sync:kyc] incoming request', summarizeKycPayload(k));

  if (!k.email) return fail(res, 400, 'User email is required to associate KYC record');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find user by email
    const userRes = await client.query(
      'SELECT id, name, first_name, last_name, mobile, updated_at FROM users WHERE email = $1',
      [k.email.toLowerCase()]
    );
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      console.warn('[sync:kyc] rollback: user not found', { email: k.email });
      return fail(res, 404, 'User not found in database for KYC association');
    }
    const dbUserId = userRes.rows[0].id;
    console.log('[sync:kyc] associated user', {
      email: k.email,
      userId: dbUserId
    });

    // Check if KYC record already exists for this user
    const kycFindRes = await client.query(
      'SELECT id, status, updated_at FROM kyc_records WHERE user_id = $1 FOR UPDATE',
      [dbUserId]
    );

    let kycResult;
    let previousStatus = null;
    if (kycFindRes.rows.length > 0) {
      // Conflict Resolution check
      const dbKyc = kycFindRes.rows[0];
      previousStatus = dbKyc.status;
      const dbUpdatedAt = new Date(dbKyc.updated_at).getTime();
      const clientUpdatedAt = k.updatedAt ? Number(k.updatedAt) : 0;

      if (clientUpdatedAt > 0 && dbUpdatedAt > clientUpdatedAt) {
        await client.query('COMMIT');
        console.log('[sync:kyc] skipped older client payload', {
          userId: dbUserId,
          dbUpdatedAt,
          clientUpdatedAt
        });
        return success(res, 'DB has newer version, skip update', { skipped: true });
      }

      // Update existing KYC record
      kycResult = await client.query(
        `UPDATE kyc_records
         SET aadhaar_front_name = COALESCE($1, aadhaar_front_name),
             aadhaar_front_size = COALESCE($2, aadhaar_front_size),
             aadhaar_front_data = COALESCE($3, aadhaar_front_data),
             aadhaar_back_name = COALESCE($4, aadhaar_back_name),
             aadhaar_back_size = COALESCE($5, aadhaar_back_size),
             aadhaar_back_data = COALESCE($6, aadhaar_back_data),
             pan_card_name = COALESCE($7, pan_card_name),
             pan_card_size = COALESCE($8, pan_card_size),
             pan_card_data = COALESCE($9, pan_card_data),
             passbook_photo_name = COALESCE($10, passbook_photo_name),
             passbook_photo_size = COALESCE($11, passbook_photo_size),
             passbook_photo_data = COALESCE($12, passbook_photo_data),
             status = $13, rejection_reason = $14, reviewed_by = $15, reviewed_at = $16,
             submitted_at = COALESCE($17, submitted_at),
             updated_at = NOW()
         WHERE user_id = $18
         RETURNING *`,
        [
          k.aadhaarFront?.name || null, k.aadhaarFront?.size || null, k.aadhaarFront?.data || null,
          k.aadhaarBack?.name || null, k.aadhaarBack?.size || null, k.aadhaarBack?.data || null,
          k.panCard?.name || null, k.panCard?.size || null, k.panCard?.data || null,
          k.passbookPhoto?.name || null, k.passbookPhoto?.size || null, k.passbookPhoto?.data || null,
          k.status || 'pending', k.rejectionReason || null,
          k.reviewedBy ? 1 : null, // admin ID placeholder
          k.reviewedAt ? new Date(k.reviewedAt) : null,
          k.submittedAt ? new Date(k.submittedAt) : null,
          dbUserId
        ]
      );
    } else {
      // Insert new KYC record (allow partial uploads)
      kycResult = await client.query(
        `INSERT INTO kyc_records
          (user_id, aadhaar_front_name, aadhaar_front_size, aadhaar_front_data,
           aadhaar_back_name, aadhaar_back_size, aadhaar_back_data,
           pan_card_name, pan_card_size, pan_card_data,
           passbook_photo_name, passbook_photo_size, passbook_photo_data,
           status, rejection_reason, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, COALESCE($16, NOW()))
         RETURNING *`,
        [
          dbUserId,
          k.aadhaarFront?.name || null, k.aadhaarFront?.size || null, k.aadhaarFront?.data || null,
          k.aadhaarBack?.name || null, k.aadhaarBack?.size || null, k.aadhaarBack?.data || null,
          k.panCard?.name || null, k.panCard?.size || null, k.panCard?.data || null,
          k.passbookPhoto?.name || null, k.passbookPhoto?.size || null, k.passbookPhoto?.data || null,
          k.status || 'pending', k.rejectionReason || null,
          k.submittedAt ? new Date(k.submittedAt) : null
        ]
      );
    }

    console.log('[sync:kyc] database write result', {
      rowCount: kycResult.rowCount,
      id: kycResult.rows[0]?.id,
      userId: kycResult.rows[0]?.user_id,
      status: kycResult.rows[0]?.status,
      submittedAt: kycResult.rows[0]?.submitted_at
    });

    // Update user's kyc_status to match the KYC record status in transaction
    const userStatusResult = await client.query(
      'UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2',
      [k.status || 'pending', dbUserId]
    );
    console.log('[sync:kyc] user status update result', {
      rowCount: userStatusResult.rowCount,
      userId: dbUserId,
      kycStatus: k.status || 'pending'
    });

    await client.query('COMMIT');

    let whatsapp = { sent: false, skipped: true, reason: 'not_applicable' };
    const finalStatus = k.status || 'pending';
    const shouldNotify = finalStatus === 'approved' && previousStatus !== 'approved';
    if (shouldNotify) {
      try {
        whatsapp = await sendKycApprovedWhatsApp(userRes.rows[0]);
      } catch (notifyErr) {
        console.error('[sync:kyc] WhatsApp notification failed after approval commit', {
          kycId: kycResult.rows[0]?.id,
          userId: dbUserId,
          reason: notifyErr.message,
          status: notifyErr.status || null,
          to: notifyErr.to || null,
          mode: notifyErr.mode || null,
          response: notifyErr.response || null
        });
        whatsapp = {
          sent: false,
          skipped: false,
          reason: notifyErr.message,
          status: notifyErr.status || null,
          to: notifyErr.to || null,
          mode: notifyErr.mode || null,
          response: notifyErr.response || null,
        };
      }
    }

    // ── Email notification (fire-and-forget) ──────────────────────────
    const statusChanged = finalStatus !== previousStatus;
    if (statusChanged && k.email) {
      const kycRow = kycResult.rows[0];
      const emailPayload = {
        ...userRes.rows[0],
        email: k.email,
        submittedAt: kycRow?.submitted_at,
        reviewedAt:  kycRow?.reviewed_at || new Date(),
        rejectionReason: kycRow?.rejection_reason,
      };
      if (finalStatus === 'approved') {
        sendKycApprovedEmail(emailPayload).catch(err =>
          console.warn('[sync:kyc] approved email failed (non-critical):', err.message)
        );
      } else if (finalStatus === 'rejected') {
        sendKycRejectedEmail(emailPayload).catch(err =>
          console.warn('[sync:kyc] rejected email failed (non-critical):', err.message)
        );
      }
    }

    console.log('[sync:kyc] transaction committed', {
      kycId: kycResult.rows[0]?.id,
      userId: dbUserId,
      whatsapp: {
        sent: whatsapp.sent,
        skipped: whatsapp.skipped,
        reason: whatsapp.reason || null,
        messageId: whatsapp.messageId || null
      }
    });
    return success(res, 'KYC synced successfully', { ...kycResult.rows[0], whatsapp });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[sync:kyc] failed', {
      message: err.message,
      code: err.code || null,
      detail: err.detail || null,
      stack: err.stack
    });
    return fail(res, 500, 'Database error during KYC sync', {
      message: err.message,
      code: err.code || null,
      detail: err.detail || null
    });
  } finally {
    client.release();
  }
});

// ─── POST /api/sync/activity ──────────────────────────────────
router.post('/activity', async (req, res) => {
  const act = req.body;

  if (!act.action) return fail(res, 400, 'Action details are required');

  try {
    const detailsJson = act.details ? JSON.stringify(act.details) : '{}';
    const result = await pool.query(
      `INSERT INTO activity_logs (user_id, user_name, action, timestamp, details, icon)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [act.userId || 'guest', act.userName || 'Guest', act.action, act.timestamp || Date.now(), detailsJson, act.icon || '📋']
    );
    return success(res, 'Activity logged successfully', result.rows[0]);
  } catch (err) {
    console.error('Sync activity error:', err);
    return fail(res, 500, 'Database error during activity sync');
  }
});

// ─── DELETE /api/sync/user ────────────────────────────────────
router.delete('/user', async (req, res) => {
  const { email, id } = req.body;
  if (!email && !id) return fail(res, 400, 'User email or ID is required for deletion');

  // Parse numeric ID if present (e.g., 'u42' -> 42, '42' -> 42)
  const rawId = id ? String(id).trim() : null;
  const numericId = rawId ? (parseInt(rawId.replace(/^u/i, ''), 10) || null) : null;
  const userEmail = email ? String(email).trim().toLowerCase() : null;

  let client = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    let findQuery = '';
    let findParams = [];

    if (numericId && userEmail) {
      findQuery = 'SELECT id, email, name FROM users WHERE id = $1 OR email = $2';
      findParams = [numericId, userEmail];
    } else if (numericId) {
      findQuery = 'SELECT id, email, name FROM users WHERE id = $1';
      findParams = [numericId];
    } else if (userEmail) {
      findQuery = 'SELECT id, email, name FROM users WHERE email = $1';
      findParams = [userEmail];
    } else {
      await client.query('ROLLBACK');
      return success(res, 'User is a client-only record and was removed from local storage', { deleted: true });
    }

    const userRes = await client.query(findQuery, findParams);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return success(res, 'User record not found in database or already deleted', { deleted: true });
    }

    const user = userRes.rows[0];

    // Remove references
    await client.query('UPDATE kyc_records SET reviewed_by = NULL WHERE reviewed_by = $1', [user.id]);
    await client.query('DELETE FROM kyc_records WHERE user_id = $1', [user.id]);
    await client.query('DELETE FROM activity_logs WHERE user_id = $1 OR user_id = $2', [String(user.id), `u${user.id}`]);
    await client.query('DELETE FROM users WHERE id = $1', [user.id]);

    await client.query('COMMIT');
    console.log(`[sync:delete/user] Deleted user ${user.email} (ID: ${user.id})`);
    return success(res, `User ${user.name || user.email} deleted successfully`, { deleted: true, id: user.id });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[sync:delete/user] Delete error:', err.message);
    return fail(res, 500, 'Failed to delete user: ' + err.message);
  } finally {
    if (client) client.release();
  }
});

// ─── DELETE /api/sync/kyc ─────────────────────────────────────
router.delete('/kyc', async (req, res) => {
  const { email, id, userId } = req.body;
  if (!email && !id && !userId) return fail(res, 400, 'KYC ID, user ID, or user email is required');

  const rawKycId = id ? String(id).trim() : null;
  const numericKycId = rawKycId ? (parseInt(rawKycId.replace(/^k/i, ''), 10) || null) : null;

  const rawUserId = userId ? String(userId).trim() : null;
  const numericUserId = rawUserId ? (parseInt(rawUserId.replace(/^u/i, ''), 10) || null) : null;

  const userEmail = email ? String(email).trim().toLowerCase() : null;

  let client = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    let findQuery = '';
    let findParams = [];

    if (numericKycId) {
      findQuery = 'SELECT id, user_id FROM kyc_records WHERE id = $1';
      findParams = [numericKycId];
    } else if (numericUserId) {
      findQuery = 'SELECT id, user_id FROM kyc_records WHERE user_id = $1';
      findParams = [numericUserId];
    } else if (userEmail) {
      findQuery = 'SELECT k.id, k.user_id FROM kyc_records k JOIN users u ON u.id = k.user_id WHERE u.email = $1';
      findParams = [userEmail];
    } else {
      await client.query('ROLLBACK');
      return success(res, 'KYC is a client-only record and was removed from local storage', { deleted: true });
    }

    const kycRes = await client.query(findQuery, findParams);
    if (kycRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return success(res, 'KYC record not found in database or already deleted', { deleted: true });
    }

    const kycRecord = kycRes.rows[0];

    await client.query('DELETE FROM kyc_records WHERE id = $1', [kycRecord.id]);
    await client.query("UPDATE users SET kyc_status = 'not_started' WHERE id = $1", [kycRecord.user_id]);

    await client.query('COMMIT');
    console.log(`[sync:delete/kyc] Deleted KYC record ${kycRecord.id} (User: ${kycRecord.user_id})`);
    return success(res, 'KYC record deleted successfully', { deleted: true, id: kycRecord.id });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[sync:delete/kyc] Delete error:', err.message);
    return fail(res, 500, 'Failed to delete KYC record: ' + err.message);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
