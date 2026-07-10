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

module.exports = router;
