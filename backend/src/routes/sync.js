const express = require('express');
const pool = require('../db');
const router = express.Router();

// Helper for consistent error responses
function fail(res, code, message) {
  return res.status(code).json({
    success: false,
    message: message
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

// ─── GET /api/sync ────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { since } = req.query;
  const sinceMs = since ? Number(since) : 0;
  
  try {
    let usersQuery = 'SELECT * FROM users ORDER BY id ASC';
    let kycQuery = 'SELECT * FROM kyc_records ORDER BY id ASC';
    let activityQuery = 'SELECT * FROM activity_logs ORDER BY timestamp DESC';
    let params = [];

    if (sinceMs > 0) {
      // Convert millisecond timestamp to TIMESTAMPTZ for users & kyc_records
      usersQuery = 'SELECT * FROM users WHERE updated_at > to_timestamp($1 / 1000.0) ORDER BY id ASC';
      kycQuery = 'SELECT * FROM kyc_records WHERE updated_at > to_timestamp($1 / 1000.0) ORDER BY id ASC';
      activityQuery = 'SELECT * FROM activity_logs WHERE timestamp > $1 ORDER BY timestamp DESC';
      params = [sinceMs];
    }

    const usersRes = await pool.query(usersQuery, params);
    const kycRes = await pool.query(kycQuery, params);
    const activityRes = await pool.query(activityQuery, params);

    // Map database records back to the static frontend objects format
    const users = usersRes.rows.map(u => ({
      id: u.role === 'admin' ? 'admin1' : u.role === 'owner' ? 'owner1' : 'u' + u.id,
      name: u.name,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      mobile: u.mobile,
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
      timeline: [
        { step: 'Profile Completed', completedAt: k.submitted_at ? new Date(k.submitted_at).getTime() - 86400000 : Date.now() - 86400000, status: 'completed' },
        { step: 'Documents Uploaded', completedAt: k.submitted_at ? new Date(k.submitted_at).getTime() - 3600000 : Date.now() - 3600000, status: 'completed' },
        { step: 'Review Completed', completedAt: k.submitted_at ? new Date(k.submitted_at).getTime() - 1800000 : Date.now() - 1800000, status: 'completed' },
        { step: 'KYC Submitted', completedAt: k.submitted_at ? new Date(k.submitted_at).getTime() : Date.now(), status: 'completed' },
        { step: 'Under Verification', completedAt: k.status !== 'pending' ? (k.reviewed_at ? new Date(k.reviewed_at).getTime() : null) : null, status: k.status !== 'pending' ? 'completed' : 'active' },
        { step: k.status === 'approved' ? 'Approved' : k.status === 'rejected' ? 'Rejected' : 'Awaiting Decision', completedAt: k.reviewed_at ? new Date(k.reviewed_at).getTime() : null, status: (k.status === 'approved' || k.status === 'rejected') ? 'completed' : 'pending' }
      ],
      updatedAt: k.updated_at ? new Date(k.updated_at).getTime() : Date.now()
    }));

    const activities = activityRes.rows.map(row => ({
      id: 'act_' + row.id,
      userId: row.user_id,
      userName: row.user_name,
      action: row.action,
      timestamp: Number(row.timestamp),
      details: row.details ? JSON.parse(row.details) : {},
      icon: row.icon
    }));

    res.json({
      success: true,
      users,
      records,
      activities
    });

  } catch (err) {
    console.error('Fetch sync data error:', err);
    return fail(res, 500, 'Database error during sync');
  }
});

// ─── POST /api/sync/user ──────────────────────────────────────
router.post('/user', async (req, res) => {
  const u = req.body;

  // Validation
  if (!u.email) return fail(res, 400, 'Email address is required');
  if (!isValidEmail(u.email)) return fail(res, 400, 'Invalid email format');
  if (u.mobile && !isValidMobile(u.mobile)) return fail(res, 400, 'Mobile must be 10 digits');
  if (u.aadharNum && !isValidAadhar(u.aadharNum)) return fail(res, 400, 'Aadhaar must be exactly 12 digits');
  if (u.panNum && !isValidPan(u.panNum)) return fail(res, 400, 'Invalid PAN format');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user already exists
    const findRes = await client.query('SELECT id, kyc_status, updated_at FROM users WHERE email = $1', [u.email.toLowerCase()]);

    let userResult;
    if (findRes.rows.length > 0) {
      // Conflict Resolution check: only update if client data is newer than DB data
      const dbUser = findRes.rows[0];
      const dbUpdatedAt = new Date(dbUser.updated_at).getTime();
      const clientUpdatedAt = u.updatedAt ? Number(u.updatedAt) : 0;

      if (clientUpdatedAt > 0 && dbUpdatedAt > clientUpdatedAt) {
        // DB is newer, don't overwrite it
        await client.query('COMMIT');
        return success(res, 'DB has newer version, skip update', { skipped: true });
      }

      // Update existing user
      userResult = await client.query(
        `UPDATE users
         SET name = $1, first_name = $2, last_name = $3, mobile = $4, gender = $5, agency_name = $6,
             address_line1 = $7, address_line2 = $8, city = $9, state = $10, pincode = $11,
             billing_address_line1 = $12, billing_address_line2 = $13,
             profile_photo = $14, kyc_status = $15, aadhar_num = $16, pan_num = $17, bank_name = $18,
             bill_landmark = $19, bill_city = $20, bill_state = $21, bill_pincode = $22,
             amazon_tag = $23, is_active = $24, is_blocked = $25, password_reset = $26,
             created_by = $27, updated_at = NOW()
         WHERE email = $28
         RETURNING *`,
        [
          u.name, u.firstName, u.lastName, u.mobile, u.gender || 'male', u.agencyName,
          u.address, u.addressLine2, u.city, u.state, u.pincode,
          u.billAddress, u.billAddress2,
          u.profilePhoto, u.kycStatus || 'not_started', u.aadharNum, u.panNum, u.bankName,
          u.billLandmark, u.billCity, u.billState, u.billPinCode,
          u.amazonTag || 'na', u.isActive !== false, u.isBlocked === true, u.passwordReset === true,
          u.createdBy || 'superadmin', u.email.toLowerCase()
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
          u.name, u.firstName, u.lastName, u.email.toLowerCase(), defaultHash, u.mobile, role, u.gender || 'male', u.agencyName,
          u.address, u.addressLine2, u.city, u.state, u.pincode, u.billAddress, u.billAddress2,
          u.profilePhoto, u.kycStatus || 'not_started', u.aadharNum, u.panNum, u.bankName, u.billLandmark, u.billCity, u.billState, u.billPinCode,
          u.amazonTag || 'na', u.isActive !== false, u.isBlocked === true, u.passwordReset === true, u.createdBy || 'superadmin'
        ]
      );
    }

    await client.query('COMMIT');
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

  if (!k.email) return fail(res, 400, 'User email is required to associate KYC record');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find user by email
    const userRes = await client.query('SELECT id, updated_at FROM users WHERE email = $1', [k.email.toLowerCase()]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'User not found in database for KYC association');
    }
    const dbUserId = userRes.rows[0].id;

    // Check if KYC record already exists for this user
    const kycFindRes = await client.query('SELECT id, status, updated_at FROM kyc_records WHERE user_id = $1', [dbUserId]);

    let kycResult;
    if (kycFindRes.rows.length > 0) {
      // Conflict Resolution check
      const dbKyc = kycFindRes.rows[0];
      const dbUpdatedAt = new Date(dbKyc.updated_at).getTime();
      const clientUpdatedAt = k.updatedAt ? Number(k.updatedAt) : 0;

      if (clientUpdatedAt > 0 && dbUpdatedAt > clientUpdatedAt) {
        await client.query('COMMIT');
        return success(res, 'DB has newer version, skip update', { skipped: true });
      }

      // Update existing KYC record
      kycResult = await client.query(
        `UPDATE kyc_records
         SET aadhaar_front_name = $1, aadhaar_front_size = $2, aadhaar_front_data = $3,
             aadhaar_back_name = $4, aadhaar_back_size = $5, aadhaar_back_data = $6,
             pan_card_name = $7, pan_card_size = $8, pan_card_data = $9,
             status = $10, rejection_reason = $11, reviewed_by = $12, reviewed_at = $13,
             updated_at = NOW()
         WHERE user_id = $14
         RETURNING *`,
        [
          k.aadhaarFront?.name || null, k.aadhaarFront?.size || null, k.aadhaarFront?.data || null,
          k.aadhaarBack?.name || null, k.aadhaarBack?.size || null, k.aadhaarBack?.data || null,
          k.panCard?.name || null, k.panCard?.size || null, k.panCard?.data || null,
          k.status || 'pending', k.rejectionReason || null,
          k.reviewedBy ? 1 : null, // admin ID placeholder
          k.reviewedAt ? new Date(k.reviewedAt) : null,
          dbUserId
        ]
      );
    } else {
      // Insert new KYC record
      kycResult = await client.query(
        `INSERT INTO kyc_records
          (user_id, aadhaar_front_name, aadhaar_front_size, aadhaar_front_data,
           aadhaar_back_name, aadhaar_back_size, aadhaar_back_data,
           pan_card_name, pan_card_size, pan_card_data,
           status, rejection_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          dbUserId,
          k.aadhaarFront?.name || null, k.aadhaarFront?.size || null, k.aadhaarFront?.data || null,
          k.aadhaarBack?.name || null, k.aadhaarBack?.size || null, k.aadhaarBack?.data || null,
          k.panCard?.name || null, k.panCard?.size || null, k.panCard?.data || null,
          k.status || 'pending', k.rejectionReason || null
        ]
      );
    }

    // Update user's kyc_status to match the KYC record status in transaction
    await client.query(
      'UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2',
      [k.status || 'pending', dbUserId]
    );

    await client.query('COMMIT');
    return success(res, 'KYC synced successfully', kycResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Sync KYC error:', err);
    return fail(res, 500, 'Database error during KYC sync');
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

module.exports = router;
