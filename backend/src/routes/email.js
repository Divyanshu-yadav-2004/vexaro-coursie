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
// Send a test email or trigger an email notification to specified recipient
router.post('/test', prodAuthGuard, async (req, res) => {
  const toEmail = String(req.body?.email || '').trim();
  const templateType = String(req.body?.type || 'welcome').toLowerCase();
  const recipientName = String(req.body?.name || 'Customer').trim();

  if (!toEmail) {
    return res.status(400).json({
      success: false,
      message: 'Email address is required',
      error: 'Missing recipient email address in request body'
    });
  }

  if (!isValidEmail(toEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email address',
      error: `"${toEmail}" is not a valid email address format.`
    });
  }

  const sampleUser = {
    name: recipientName,
    userId: req.body?.userId || 99,
    email: toEmail,
    submittedAt: new Date(),
    reviewedAt: new Date(),
    rejectionReason: req.body?.rejectionReason || 'Sample document verification issue.',
  };

  try {
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
      case 'action_required':
        result = await sendKycRejectedEmail(sampleUser);
        break;
      case 'password_reset':
      case 'reset':
        result = await sendPasswordResetEmail(sampleUser, 'https://vexaro.co.in/reset-password.html?token=test', 60);
        break;
      case 'security':
      case 'login':
        result = await sendSecurityNotificationEmail(sampleUser, {
          event: 'Security Notification Test',
          eventTime: new Date(),
          deviceInfo: 'Vexaro Admin Portal',
        });
        break;
      default:
        result = await sendSystemTestEmail(toEmail);
        break;
    }

    if (!result || !result.sent) {
      const errorMsg = result?.error || result?.reason || 'SMTP delivery failed or was skipped due to missing configuration.';
      return res.status(500).json({
        success: false,
        message: 'Email could not be sent',
        error: errorMsg,
        details: result
      });
    }

    return res.status(200).json({
      success: true,
      message: `Email (${templateType}) sent successfully to ${toEmail}`,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('[email:test] Error in email test handler:', err);
    return res.status(500).json({
      success: false,
      message: 'Email could not be sent',
      error: err.message || 'Internal server error while sending email'
    });
  }
});

module.exports = router;
