const express = require('express');
const {
  sendSystemTestEmail,
  buildWelcomeHtml,
  buildKycSubmittedHtml,
  buildKycApprovedHtml,
  buildKycRejectedHtml,
  buildPasswordResetHtml,
  buildSecurityNotificationHtml,
  sendWelcomeEmail,
  sendKycSubmittedEmail,
  sendKycApprovedEmail,
  sendKycRejectedEmail,
  sendPasswordResetEmail,
  sendSecurityNotificationEmail,
} = require('../services/email');

const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Production security guard: in production, require admin authentication for preview/testing
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const prodAuthGuard = (req, res, next) => {
  if (isProduction) {
    return authMiddleware(req, res, () => {
      return roleGuard('admin', 'owner')(req, res, next);
    });
  }
  next();
};

// ─── GET /api/email/preview ───────────────────────────────────
// Preview rendered email templates directly in browser
router.get('/preview', prodAuthGuard, (req, res) => {
  const { type = 'welcome' } = req.query;

  const sampleUser = {
    name: 'Demo User',
    userId: 34,
    email: 'demo@example.com',
    submittedAt: new Date(Date.now() - 86400000 * 2),
    reviewedAt: new Date(),
    rejectionReason: 'The PAN Card document uploaded is unreadable or blurry. Please upload a clear photo or PDF.',
  };

  let html;
  switch (type.toLowerCase()) {
    case 'welcome':
      html = buildWelcomeHtml(sampleUser);
      break;
    case 'submitted':
      html = buildKycSubmittedHtml(sampleUser);
      break;
    case 'approved':
      html = buildKycApprovedHtml(sampleUser);
      break;
    case 'rejected':
    case 'action_required':
      html = buildKycRejectedHtml(sampleUser);
      break;
    case 'password_reset':
    case 'reset':
      html = buildPasswordResetHtml({
        name: sampleUser.name,
        resetUrl: 'https://vexaro.co.in/reset-password.html?token=sample_token_123',
        expiresInMinutes: 60,
      });
      break;
    case 'security':
    case 'login':
      html = buildSecurityNotificationHtml({
        name: sampleUser.name,
        event: 'New Device Login',
        eventTime: new Date(),
        deviceInfo: 'Chrome 122 on Windows 11 (IP: 103.21.124.5)',
      });
      break;
    default:
      return res.status(400).send(`
        <h3>Available Email Preview Types:</h3>
        <ul>
          <li><a href="?type=welcome">?type=welcome</a></li>
          <li><a href="?type=submitted">?type=submitted</a></li>
          <li><a href="?type=approved">?type=approved</a></li>
          <li><a href="?type=rejected">?type=rejected</a></li>
          <li><a href="?type=password_reset">?type=password_reset</a></li>
          <li><a href="?type=security">?type=security</a></li>
        </ul>
      `);
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ─── POST /api/email/test ─────────────────────────────────────
// Send a test email to specified recipient (defaults to vexarocouriersolution@gmail.com)
router.post('/test', prodAuthGuard, async (req, res) => {
  const toEmail = String(req.body?.email || 'vexarocouriersolution@gmail.com').trim();
  const templateType = String(req.body?.type || 'welcome').toLowerCase();

  if (!isValidEmail(toEmail)) {
    return res.status(400).json({ error: 'A valid recipient email address is required in the "email" field.' });
  }

  const sampleUser = {
    name: 'Test User',
    userId: 99,
    email: toEmail,
    submittedAt: new Date(),
    reviewedAt: new Date(),
    rejectionReason: 'Sample rejection reason for testing purposes.',
  };

  let result;
  switch (templateType) {
    case 'welcome':
      result = await sendWelcomeEmail(sampleUser);
      break;
    case 'submitted':
      result = await sendKycSubmittedEmail(sampleUser);
      break;
    case 'approved':
      result = await sendKycApprovedEmail(sampleUser);
      break;
    case 'rejected':
      result = await sendKycRejectedEmail(sampleUser);
      break;
    case 'password_reset':
      result = await sendPasswordResetEmail(sampleUser, 'https://vexaro.co.in/reset-password.html?token=test', 60);
      break;
    case 'security':
      result = await sendSecurityNotificationEmail(sampleUser, {
        event: 'Test Security Alert',
        eventTime: new Date(),
        deviceInfo: 'Chrome Test Client',
      });
      break;
    default:
      result = await sendSystemTestEmail(toEmail);
      break;
  }

  if (!result.sent) {
    return res.status(500).json({
      error: 'Failed to send test email.',
      details: result,
    });
  }

  return res.status(200).json({
    message: `Test email (${templateType}) sent successfully to ${toEmail}.`,
    messageId: result.messageId,
  });
});

module.exports = router;
