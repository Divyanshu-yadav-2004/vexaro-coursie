const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ─── Helper: format user object for API response ──────────────
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

// ─── POST /api/auth/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  const {
    firstName, lastName, email, password, mobile,
    gender, agencyName, addressLine1, addressLine2,
    city, state, pincode, billingAddressLine1, billingAddressLine2,
    sameAsPermanent
  } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'firstName, lastName, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check for existing user
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const fullName = `${firstName} ${lastName}`.trim();

    const result = await pool.query(
      `INSERT INTO users
        (name, first_name, last_name, email, password_hash, mobile, role, gender,
         agency_name, address_line1, address_line2, city, state, pincode,
         billing_address_line1, billing_address_line2, same_as_permanent, kyc_status)
       VALUES ($1,$2,$3,$4,$5,$6,'user',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'not_started')
       RETURNING *`,
      [
        fullName, firstName, lastName, email.toLowerCase(), passwordHash,
        mobile || null, gender || 'male', agencyName || null,
        addressLine1 || null, addressLine2 || null,
        city || null, state || null, pincode || null,
        billingAddressLine1 || null, billingAddressLine2 || null,
        sameAsPermanent !== false
      ]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token, user: formatUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: formatUser(result.rows[0]) });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/auth/demo-users ───────────────────────────────────
router.get('/demo-users', async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role, kyc_status FROM users WHERE role = 'user' ORDER BY id ASC");
    res.json({
      users: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        kycStatus: row.kyc_status
      }))
    });
  } catch (err) {
    console.error('Fetch demo users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/auth/demo-login ──────────────────────────────────
router.post('/demo-login', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token, user: formatUser(user) });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ error: 'Server error during demo login' });
  }
});

module.exports = router;
