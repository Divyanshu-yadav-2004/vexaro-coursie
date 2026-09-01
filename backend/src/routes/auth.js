const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendSecurityNotificationEmail
} = require('../services/email');

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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cleanEmail = email.toLowerCase().trim();
    const cleanMobile = mobile ? String(mobile).replace(/\D/g, '') : null;

    // Check for existing user by email OR mobile
    let findQuery = 'SELECT id, email, mobile FROM users WHERE LOWER(email) = $1';
    let findParams = [cleanEmail];
    if (cleanMobile) {
      findQuery += ' OR (mobile IS NOT NULL AND mobile = $2)';
      findParams.push(cleanMobile);
    }

    const existing = await client.query(findQuery, findParams);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      const match = existing.rows[0];
      if (cleanMobile && match.mobile === cleanMobile && match.email === cleanEmail) {
        return res.status(409).json({ error: 'An account with this email and mobile number already exists. Please log in.' });
      } else if (cleanMobile && match.mobile === cleanMobile) {
        return res.status(409).json({ error: 'An account with this mobile number already exists. Please log in.' });
      } else {
        return res.status(409).json({ error: 'An account with this email address already exists. Please log in.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const fullName = `${firstName} ${lastName}`.trim();

    const result = await client.query(
      `INSERT INTO users
        (name, first_name, last_name, email, password_hash, mobile, role, gender,
         agency_name, address_line1, address_line2, city, state, pincode,
         billing_address_line1, billing_address_line2, same_as_permanent, kyc_status)
       VALUES ($1,$2,$3,$4,$5,$6,'user',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'not_started')
       RETURNING *`,
      [
        fullName, firstName, lastName, cleanEmail, passwordHash,
        cleanMobile || null, gender || 'male', agencyName || null,
        addressLine1 || null, addressLine2 || null,
        city || null, state || null, pincode || null,
        billingAddressLine1 || null, billingAddressLine2 || null,
        sameAsPermanent !== false
      ]
    );

    await client.query('COMMIT');

    const user = result.rows[0];

    console.log(`[AUTH] User registered successfully: ${user.email}`);

    // Trigger Welcome Email (non-blocking async execution)
    if (user.email) {
      sendWelcomeEmail(user)
        .then(emailResult => {
          if (!emailResult.sent) {
            if (!emailResult.skipped) {
              console.error(`[EMAIL ERROR] Welcome email failed for ${user.email}`);
              console.error(`[EMAIL ERROR] ${emailResult.error || emailResult.reason || 'Unknown delivery failure'}`);
            } else {
              console.warn(`[EMAIL] Welcome email skipped for ${user.email}: ${emailResult.reason}`);
            }
          }
        })
        .catch(emailErr => {
          console.error(`[EMAIL ERROR] Welcome email failed for ${user.email}`);
          console.error(`[EMAIL ERROR] ${emailErr.message}`);
        });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'vexaro_super_secret_jwt_key_2026',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ token, user: formatUser(user) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Register error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email or mobile number already exists. Please log in.' });
    }
    res.status(500).json({ error: 'Server error during registration' });
  } finally {
    client.release();
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
      process.env.JWT_SECRET || 'vexaro_super_secret_jwt_key_2026',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Send Security Notification (non-blocking)
    if (user.email) {
      const userAgent = req.headers['user-agent'] || 'Web Browser';
      sendSecurityNotificationEmail(user, {
        event: 'Account Login',
        eventTime: new Date(),
        deviceInfo: userAgent.length > 80 ? userAgent.substring(0, 77) + '...' : userAgent,
      }).catch(emailErr =>
        console.warn('[auth:login] security email notification failed (non-critical):', emailErr.message)
      );
    }

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
      process.env.JWT_SECRET || 'vexaro_super_secret_jwt_key_2026',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token, user: formatUser(user) });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ error: 'Server error during demo login' });
  }
});

// ─── POST /api/auth/forgot-password ───────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);

    // Always respond with success to prevent user enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
    }

    const user = result.rows[0];
    const resetToken = jwt.sign(
      { id: user.id, email: user.email, purpose: 'password_reset' },
      process.env.JWT_SECRET || 'vexaro_super_secret_jwt_key_2026',
      { expiresIn: '1h' }
    );

    const portalBase = process.env.APP_BASE_URL || process.env.VEXARO_PORTAL_URL || 'https://vexaro.co.in';
    const resetUrl = `${portalBase}/reset-password.html?token=${resetToken}`;

    // Send email asynchronously (non-blocking)
    sendPasswordResetEmail(user, resetUrl, 60).catch(err =>
      console.warn('[auth:forgot-password] email send failed:', err.message)
    );

    res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error processing password reset request' });
  }
});

module.exports = router;
