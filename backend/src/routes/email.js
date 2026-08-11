const express = require('express');
const { sendSystemTestEmail } = require('../services/email');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

router.post('/test', async (req, res) => {
  const toEmail = String(req.body?.email || '').trim();
  if (!isValidEmail(toEmail)) {
    return res.status(400).json({ error: 'A valid recipient email address is required in the "email" field.' });
  }

  const result = await sendSystemTestEmail(toEmail);
  if (!result.sent) {
    console.error('[routes:email] system test email failed', {
      to: toEmail,
      reason: result.reason || null,
      error: result.error || null,
    });
    return res.status(500).json({ error: 'Failed to send test email. Check server logs for details.' });
  }

  console.info('[routes:email] system test email succeeded', {
    to: toEmail,
    messageId: result.messageId,
  });

  return res.status(200).json({
    message: `Test email sent to ${toEmail}. Check inbox or spam folder.`,
    messageId: result.messageId,
  });
});

module.exports = router;
