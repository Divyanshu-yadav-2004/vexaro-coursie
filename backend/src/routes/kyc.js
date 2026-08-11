const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { sendKycApprovedWhatsApp } = require('../services/whatsapp');
const { sendKycSubmittedEmail, sendKycApprovedEmail, sendKycRejectedEmail } = require('../services/email');

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
    passbookPhoto: row.passbook_photo_path ? {
      name: row.passbook_photo_name,
      size: row.passbook_photo_size,
      path: row.passbook_photo_path,
    } : null,
    status: row.status,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}

// ─── POST /api/kyc/submit ─────────────────────────────────────
// Accepts multipart: aadhaarFront, aadhaarBack, panCard, passbookPhoto files
router.post(
  '/submit',
  authMiddleware,
  upload.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
    { name: 'passbookPhoto', maxCount: 1 }
  ]),
  async (req, res) => {
    const userId = req.user.id;
    const files = req.files || {};

    if (!files.aadhaarFront || !files.aadhaarBack || !files.panCard || !files.passbookPhoto) {
      return res.status(400).json({ error: 'aadhaarFront, aadhaarBack, panCard, and passbookPhoto files are required' });
    }

    const aadhaarFront = files.aadhaarFront[0];
    const aadhaarBack = files.aadhaarBack[0];
    const panCard = files.panCard[0];
    const passbookPhoto = files.passbookPhoto ? files.passbookPhoto[0] : null;

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
           pan_card_path, pan_card_name, pan_card_size,
           passbook_photo_path, passbook_photo_name, passbook_photo_size,
           status, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending', NOW())
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
           passbook_photo_path = COALESCE(EXCLUDED.passbook_photo_path, kyc_records.passbook_photo_path),
           passbook_photo_name = COALESCE(EXCLUDED.passbook_photo_name, kyc_records.passbook_photo_name),
           passbook_photo_size = COALESCE(EXCLUDED.passbook_photo_size, kyc_records.passbook_photo_size),
           status              = 'pending',
           rejection_reason    = NULL,
           submitted_at        = NOW()
         RETURNING *`,
        [
          userId,
          aadhaarFront.filename, aadhaarFront.originalname, formatSize(aadhaarFront.size),
          aadhaarBack.filename, aadhaarBack.originalname, formatSize(aadhaarBack.size),
          panCard.filename, panCard.originalname, formatSize(panCard.size),
          passbookPhoto ? passbookPhoto.filename : null,
          passbookPhoto ? passbookPhoto.originalname : null,
          passbookPhoto ? formatSize(passbookPhoto.size) : null
        ]
      );

      // Update user's kyc_status
      await pool.query(
        `UPDATE users SET kyc_status = 'pending' WHERE id = $1`,
        [userId]
      );

      // Fetch user details for email notification
      const userRow = await pool.query(
        'SELECT id, email, name, first_name, last_name FROM users WHERE id = $1',
        [userId]
      );
      const kycRow = result.rows[0];

      // Send KYC Submitted email (non-blocking — never fails the HTTP response)
      if (userRow.rows[0]?.email) {
        sendKycSubmittedEmail({
          ...userRow.rows[0],
          submittedAt: kycRow.submitted_at || new Date(),
        }).catch(emailErr =>
          console.warn('[kyc:submit] email notification failed (non-critical):', emailErr.message)
        );
      }

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

  console.info('[kyc:status] request received', {
    kycId: id,
    requestedStatus: status,
    actorId: req.user?.id || null,
  });

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
      console.warn('[kyc:status] record not found', { kycId: id });
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
    console.info('[kyc:status] database update committed', {
      kycId: result.rows[0].id,
      userId: result.rows[0].user_id,
      previousStatus,
      status,
    });

    let whatsapp = { sent: false, skipped: true, reason: 'not_applicable' };
    const statusChanged = previousStatus !== status;
    const kycRecord = result.rows[0];
    const userInfo = userResult.rows[0];

    // ── WhatsApp (approved only) ──────────────────────────────
    const shouldWhatsApp = status === 'approved' && statusChanged && userInfo;
    if (shouldWhatsApp) {
      try {
        whatsapp = await sendKycApprovedWhatsApp(userInfo);
      } catch (notifyErr) {
        console.error('[kyc:status] WhatsApp notification failed after approval commit', {
          kycId: kycRecord.id,
          userId: kycRecord.user_id,
          reason: notifyErr.message,
          status: notifyErr.status || null,
          to: notifyErr.to || null,
          mode: notifyErr.mode || null,
          response: notifyErr.response || null,
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

    // ── Email notification (approved + rejected, fire-and-forget) ──
    if (statusChanged && userInfo?.email) {
      const emailPayload = {
        ...userInfo,
        submittedAt: kycRecord.submitted_at,
        reviewedAt:  kycRecord.reviewed_at || new Date(),
        rejectionReason: kycRecord.rejection_reason,
      };
      if (status === 'approved') {
        sendKycApprovedEmail(emailPayload).catch(err =>
          console.warn('[kyc:status] approved email failed (non-critical):', err.message)
        );
      } else if (status === 'rejected') {
        sendKycRejectedEmail(emailPayload).catch(err =>
          console.warn('[kyc:status] rejected email failed (non-critical):', err.message)
        );
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
    console.error('[kyc:status] failed before commit', {
      kycId: id,
      requestedStatus: status,
      message: err.message,
      code: err.code || null,
      detail: err.detail || null,
      stack: err.stack,
    });
    res.status(500).json({
      error: 'KYC status update failed',
      details: {
        message: err.message,
        code: err.code || null,
        detail: err.detail || null,
      },
    });
  } finally {
    client.release();
  }
});

// ─── GET /api/kyc/email-preview ───────────────────────────────
// Preview generated email HTML directly in browser
router.get('/email-preview', (req, res) => {
  const { type = 'submitted' } = req.query;
  const { buildKycSubmittedHtml, buildKycApprovedHtml, buildKycRejectedHtml } = require('../services/email');

  const sampleUser = {
    name: 'Rahul Sharma',
    userId: 3,
    submittedAt: new Date(),
    reviewedAt: new Date(),
    rejectionReason: 'The PAN Card photo provided is blurry and unreadable. Please upload a clear document image.',
  };

  let html;
  if (type === 'approved') {
    html = buildKycApprovedHtml(sampleUser);
  } else if (type === 'rejected') {
    html = buildKycRejectedHtml(sampleUser);
  } else {
    html = buildKycSubmittedHtml(sampleUser);
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

module.exports = router;
