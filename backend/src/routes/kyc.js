const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { sendKycApprovedWhatsApp } = require('../services/whatsapp');

const router = express.Router();

// ─── Multer Storage Config ────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.fieldname + '-' + req.user.id + '-' + Date.now() + ext;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
};

const maxSize = (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSize }
});

// ─── Helper: format KYC record for API response ───────────────
function formatKYC(row) {
  return {
    id: row.id,
    userId: row.user_id,
    aadhaarFront: row.aadhaar_front_path ? {
      name: row.aadhaar_front_name,
      size: row.aadhaar_front_size,
      path: row.aadhaar_front_path,
    } : null,
    aadhaarBack: row.aadhaar_back_path ? {
      name: row.aadhaar_back_name,
      size: row.aadhaar_back_size,
      path: row.aadhaar_back_path,
    } : null,
    panCard: row.pan_card_path ? {
      name: row.pan_card_name,
      size: row.pan_card_size,
      path: row.pan_card_path,
    } : null,
    status: row.status,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}

// ─── POST /api/kyc/submit ─────────────────────────────────────
// Accepts multipart: aadhaarFront, aadhaarBack, panCard files
router.post(
  '/submit',
  authMiddleware,
  upload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 }
  ]),
  async (req, res) => {
    const userId = req.user.id;
    const files = req.files || {};

    if (!files.aadhaarFront || !files.aadhaarBack || !files.panCard) {
      return res.status(400).json({ error: 'aadhaarFront, aadhaarBack, and panCard files are required' });
    }

    const aadhaarFront = files.aadhaarFront[0];
    const aadhaarBack = files.aadhaarBack[0];
    const panCard = files.panCard[0];

    const formatSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    try {
      // Upsert: insert or update on user_id conflict
      const result = await pool.query(
        `INSERT INTO kyc_records
          (user_id, aadhaar_front_path, aadhaar_front_name, aadhaar_front_size,
           aadhaar_back_path, aadhaar_back_name, aadhaar_back_size,
           pan_card_path, pan_card_name, pan_card_size, status, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending', NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           aadhaar_front_path  = EXCLUDED.aadhaar_front_path,
           aadhaar_front_name  = EXCLUDED.aadhaar_front_name,
           aadhaar_front_size  = EXCLUDED.aadhaar_front_size,
           aadhaar_back_path   = EXCLUDED.aadhaar_back_path,
           aadhaar_back_name   = EXCLUDED.aadhaar_back_name,
           aadhaar_back_size   = EXCLUDED.aadhaar_back_size,
           pan_card_path       = EXCLUDED.pan_card_path,
           pan_card_name       = EXCLUDED.pan_card_name,
           pan_card_size       = EXCLUDED.pan_card_size,
           status              = 'pending',
           rejection_reason    = NULL,
           submitted_at        = NOW()
         RETURNING *`,
        [
          userId,
          aadhaarFront.filename, aadhaarFront.originalname, formatSize(aadhaarFront.size),
          aadhaarBack.filename, aadhaarBack.originalname, formatSize(aadhaarBack.size),
          panCard.filename, panCard.originalname, formatSize(panCard.size)
        ]
      );

      // Update user's kyc_status
      await pool.query(
        `UPDATE users SET kyc_status = 'pending' WHERE id = $1`,
        [userId]
      );

      res.status(201).json({ message: 'KYC submitted successfully', kyc: formatKYC(result.rows[0]) });
    } catch (err) {
      console.error('KYC submit error:', err);
      res.status(500).json({ error: 'Server error during KYC submission' });
    }
  }
);

// ─── GET /api/kyc/my ─────────────────────────────────────────
// Returns the current user's KYC record
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM kyc_records WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.json({ kyc: null });
    }
    res.json({ kyc: formatKYC(result.rows[0]) });
  } catch (err) {
    console.error('Get my KYC error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/kyc/all ─────────────────────────────────────────
// Admin/owner: get all KYC records with user info joined
router.get('/all', authMiddleware, roleGuard('admin', 'owner'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        k.*,
        u.name         AS user_name,
        u.email        AS user_email,
        u.mobile       AS user_mobile,
        u.first_name,
        u.last_name,
        u.gender,
        u.agency_name,
        u.city,
        u.state,
        u.pincode,
        u.created_at   AS user_created_at
      FROM kyc_records k
      JOIN users u ON u.id = k.user_id
      ORDER BY k.submitted_at DESC
    `);

    const records = result.rows.map(row => ({
      ...formatKYC(row),
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        mobile: row.user_mobile,
        firstName: row.first_name,
        lastName: row.last_name,
        gender: row.gender,
        agencyName: row.agency_name,
        city: row.city,
        state: row.state,
        pincode: row.pincode,
        createdAt: row.user_created_at,
      }
    }));

    res.json({ records });
  } catch (err) {
    console.error('Get all KYC error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PATCH /api/kyc/:id/status ────────────────────────────────
// Admin/owner: approve or reject a KYC record
router.patch('/:id/status', authMiddleware, roleGuard('admin', 'owner'), async (req, res) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
  }

  if (status === 'rejected' && !rejectionReason) {
    return res.status(400).json({ error: 'rejectionReason is required when rejecting' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id, user_id, status FROM kyc_records WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'KYC record not found' });
    }

    const previousStatus = existing.rows[0].status;

    // Update KYC record
    const result = await client.query(
      `UPDATE kyc_records
       SET status = $1, rejection_reason = $2, reviewed_at = NOW(), reviewed_by = $3
       WHERE id = $4
       RETURNING *`,
      [status, status === 'rejected' ? rejectionReason : null, req.user.id, id]
    );

    // Update user's kyc_status to match
    const userResult = await client.query(
      `UPDATE users SET kyc_status = $1 WHERE id = $2 RETURNING id, name, first_name, last_name, mobile`,
      [status, result.rows[0].user_id]
    );

    await client.query('COMMIT');

    let whatsapp = { sent: false, skipped: true, reason: 'not_applicable' };
    const shouldNotify = status === 'approved' && previousStatus !== 'approved' && userResult.rows[0];
    if (shouldNotify) {
      try {
        whatsapp = await sendKycApprovedWhatsApp(userResult.rows[0]);
      } catch (notifyErr) {
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

    console.info('[kyc] status updated', {
      kycId: result.rows[0].id,
      userId: result.rows[0].user_id,
      previousStatus,
      status,
      whatsapp: {
        sent: whatsapp.sent,
        skipped: whatsapp.skipped,
        reason: whatsapp.reason || null,
        messageId: whatsapp.messageId || null,
      },
    });

    res.json({ message: `KYC ${status} successfully`, kyc: formatKYC(result.rows[0]), whatsapp });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Update KYC status error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
