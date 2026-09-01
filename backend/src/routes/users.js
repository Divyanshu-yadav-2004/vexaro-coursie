const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

function formatUser(row) {
  return {
    id: row.id,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    mobile: row.mobile,
    role: row.role,
    gender: row.gender,
    agencyName: row.agency_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    billingAddressLine1: row.billing_address_line1,
    billingAddressLine2: row.billing_address_line2,
    sameAsPermanent: row.same_as_permanent,
    profilePhoto: row.profile_photo,
    kycStatus: row.kyc_status,
    createdAt: row.created_at,
  };
}

// ─── GET /api/users ───────────────────────────────────────────
// Admin/owner: get all users (with their KYC status)
router.get('/', authMiddleware, roleGuard('admin', 'owner'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM users ORDER BY created_at DESC`
    );
    res.json({ users: result.rows.map(formatUser) });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/users/profile ─────────────────────────────────
// Current user: update their own profile info
router.patch('/profile', authMiddleware, async (req, res) => {
  const {
    firstName, lastName, mobile, gender, agencyName,
    addressLine1, addressLine2, city, state, pincode,
    billingAddressLine1, billingAddressLine2, sameAsPermanent, profilePhoto
  } = req.body;

  try {
    const fullName = firstName && lastName ? `${firstName} ${lastName}`.trim() : undefined;

    const result = await pool.query(
      `UPDATE users SET
        name                  = COALESCE($1, name),
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
        same_as_permanent     = COALESCE($14, same_as_permanent),
        profile_photo         = COALESCE($15, profile_photo)
      WHERE id = $16
      RETURNING *`,
      [
        fullName || null, firstName || null, lastName || null,
        mobile || null, gender || null, agencyName || null,
        addressLine1 || null, addressLine2 || null,
        city || null, state || null, pincode || null,
        billingAddressLine1 || null, billingAddressLine2 || null,
        sameAsPermanent !== undefined ? sameAsPermanent : null,
        profilePhoto || null,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: formatUser(result.rows[0]) });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/users/:id ────────────────────────────────────
// Admin/owner: permanently delete a user and child records
router.delete('/:id', authMiddleware, roleGuard('admin', 'owner'), async (req, res) => {
  const { id } = req.params;
  const rawId = id ? String(id).trim() : '';
  const numericId = parseInt(rawId.replace(/^u/i, ''), 10) || null;

  let client = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Verify target user exists
    let userRes;
    if (numericId) {
      userRes = await client.query('SELECT id, email, name, role FROM users WHERE id = $1', [numericId]);
    } else {
      userRes = await client.query('SELECT id, email, name, role FROM users WHERE email = $1', [rawId.toLowerCase()]);
    }

    if (!userRes || userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];

    // 2. Prevent self-deletion
    if (String(user.id) === String(req.user.id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot delete your own admin account while logged in.' });
    }

    // 3. Clear reviewed_by references on kyc_records to prevent FK constraint failures
    await client.query('UPDATE kyc_records SET reviewed_by = NULL WHERE reviewed_by = $1', [user.id]);

    // 4. Delete child kyc_records
    await client.query('DELETE FROM kyc_records WHERE user_id = $1', [user.id]);

    // 5. Delete activity logs for this user
    await client.query('DELETE FROM activity_logs WHERE user_id = $1 OR user_id = $2', [String(user.id), `u${user.id}`]);

    // 6. Delete user record
    await client.query('DELETE FROM users WHERE id = $1', [user.id]);

    await client.query('COMMIT');
    console.log(`[users:delete] User ${user.email} (ID: ${user.id}) deleted by admin ${req.user.email || req.user.id}`);

    res.json({ message: `User "${user.name || user.email}" deleted successfully`, deletedId: user.id });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[users:delete] Error deleting user:', err.message);
    res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
