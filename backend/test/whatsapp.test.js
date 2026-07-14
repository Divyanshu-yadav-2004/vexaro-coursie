const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildKycApprovedPayload,
  normalizeWhatsAppNumber,
  sendKycApprovedWhatsApp,
} = require('../src/services/whatsapp');

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
}

test.afterEach(resetEnv);

test('normalizes Indian 10-digit mobile numbers for WhatsApp', () => {
  process.env.WHATSAPP_DEFAULT_COUNTRY_CODE = '91';
  assert.equal(normalizeWhatsAppNumber('98765 43210'), '919876543210');
  assert.equal(normalizeWhatsAppNumber('+91 98765 43210'), '919876543210');
});

test('builds a template payload when a KYC approval template is configured', () => {
  process.env.WHATSAPP_KYC_APPROVED_TEMPLATE_NAME = 'kyc_approved';
  process.env.WHATSAPP_KYC_APPROVED_TEMPLATE_LANGUAGE = 'en_US';

  const payload = buildKycApprovedPayload('919876543210', 'Rahul Sharma');

  assert.equal(payload.mode, 'template');
  assert.deepEqual(payload.body, {
    messaging_product: 'whatsapp',
    to: '919876543210',
    type: 'template',
    template: {
      name: 'kyc_approved',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: 'Rahul Sharma',
            },
          ],
        },
      ],
    },
  });
});

test('returns skipped when WhatsApp credentials are not configured', async () => {
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;

  const result = await sendKycApprovedWhatsApp({ name: 'Rahul Sharma', mobile: '9876543210' });

  assert.equal(result.sent, false);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'whatsapp_not_configured');
});

test('posts to the Cloud API and returns the message id', async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  process.env.WHATSAPP_API_VERSION = 'v20.0';
  process.env.WHATSAPP_KYC_APPROVED_TEMPLATE_NAME = 'kyc_approved';

  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        messages: [{ id: 'wamid.test-message-id' }],
        contacts: [{ wa_id: '919876543210' }],
      }),
    };
  };

  const result = await sendKycApprovedWhatsApp({ name: 'Rahul Sharma', mobile: '9876543210' });

  assert.equal(request.url, 'https://graph.facebook.com/v20.0/123456789/messages');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.equal(JSON.parse(request.options.body).template.name, 'kyc_approved');
  assert.equal(result.sent, true);
  assert.equal(result.messageId, 'wamid.test-message-id');
  assert.equal(result.to, '********3210');
});
