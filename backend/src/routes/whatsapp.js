const express = require('express');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const {
  getWhatsAppConfigStatus,
  verifyWhatsAppCredentials,
} = require('../services/whatsapp');

const router = express.Router();

router.get('/status', authMiddleware, roleGuard('admin', 'owner'), async (req, res) => {
  const status = await verifyWhatsAppCredentials();
  console.info('[whatsapp:status] verification result', {
    ok: status.ok,
    configured: status.config.configured,
    missing: status.config.missing,
    status: status.status || null,
    error: status.error || null,
  });
  res.status(status.ok ? 200 : 503).json(status);
});

router.get('/config', authMiddleware, roleGuard('admin', 'owner'), (req, res) => {
  res.json({ config: getWhatsAppConfigStatus() });
});

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && expectedToken && token === expectedToken) {
    console.info('[whatsapp:webhook] webhook verified');
    return res.status(200).send(challenge);
  }

  console.warn('[whatsapp:webhook] verification failed', {
    mode,
    hasExpectedToken: Boolean(expectedToken),
    tokenMatched: expectedToken ? token === expectedToken : false,
  });
  return res.sendStatus(403);
});

router.post('/webhook', (req, res) => {
  const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
  const changes = entries.flatMap(entry => Array.isArray(entry.changes) ? entry.changes : []);

  changes.forEach(change => {
    const value = change.value || {};
    const statuses = Array.isArray(value.statuses) ? value.statuses : [];
    const messages = Array.isArray(value.messages) ? value.messages : [];

    statuses.forEach(status => {
      console.info('[whatsapp:webhook] message status', {
        id: status.id || null,
        status: status.status || null,
        recipientId: status.recipient_id || null,
        timestamp: status.timestamp || null,
        errors: status.errors || null,
      });
    });

    messages.forEach(message => {
      console.info('[whatsapp:webhook] inbound message received', {
        id: message.id || null,
        from: message.from || null,
        type: message.type || null,
        timestamp: message.timestamp || null,
      });
    });
  });

  res.sendStatus(200);
});

module.exports = router;
