function normalizeWhatsAppNumber(rawMobile) {
  const digits = String(rawMobile || '').replace(/\D/g, '');
  if (!digits) return '';

  const countryCode = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '');
  if (digits.length === 10 && countryCode) {
    return `${countryCode}${digits}`;
  }

  return digits;
}

function buildKycApprovedMessage(userName) {
  const name = userName || 'Customer';
  return `Hello ${name}, your KYC verification has been completed and approved by Vexaro Courier Solution Private Limited. You can now continue using your account.`;
}

async function sendWhatsAppText(toMobile, message) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
  const to = normalizeWhatsAppNumber(toMobile);

  if (!to) {
    return { sent: false, skipped: true, reason: 'missing_mobile' };
  }

  if (!phoneNumberId || !accessToken) {
    return { sent: false, skipped: true, reason: 'whatsapp_not_configured' };
  }

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `WhatsApp send failed with status ${response.status}`);
  }

  return { sent: true, skipped: false, to, response: data };
}

async function sendKycApprovedWhatsApp(user) {
  return sendWhatsAppText(user.mobile, buildKycApprovedMessage(user.name));
}

module.exports = {
  buildKycApprovedMessage,
  normalizeWhatsAppNumber,
  sendKycApprovedWhatsApp,
};
