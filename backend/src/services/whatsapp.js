function normalizeWhatsAppNumber(rawMobile) {
  const digits = String(rawMobile || '').replace(/\D/g, '');
  if (!digits) return '';

  const countryCode = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '');
  if (digits.length === 10 && countryCode) {
    return `${countryCode}${digits}`;
  }

  return digits;
}

function maskWhatsAppNumber(number) {
  const digits = String(number || '').replace(/\D/g, '');
  if (digits.length <= 4) return digits ? '****' : '';
  return `${'*'.repeat(Math.max(digits.length - 4, 4))}${digits.slice(-4)}`;
}

function buildKycApprovedMessage(userName) {
  const name = userName || 'Customer';
  return `Hello ${name}, your KYC verification has been completed and approved by Vexaro Courier Solution Private Limited. You can now continue using your account.`;
}

function buildKycApprovedPayload(to, userName) {
  const templateName = process.env.WHATSAPP_KYC_APPROVED_TEMPLATE_NAME;
  const templateLanguage = process.env.WHATSAPP_KYC_APPROVED_TEMPLATE_LANGUAGE || 'en_US';
  const includeNameParam = process.env.WHATSAPP_KYC_APPROVED_TEMPLATE_INCLUDE_NAME !== 'false';

  if (templateName) {
    const template = {
      name: templateName,
      language: { code: templateLanguage },
    };

    if (includeNameParam) {
      template.components = [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: userName || 'Customer',
            },
          ],
        },
      ];
    }

    return {
      mode: 'template',
      body: {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template,
      },
    };
  }

  return {
    mode: 'text',
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: buildKycApprovedMessage(userName),
      },
    },
  };
}

function summarizeWhatsAppResponse(responseBody = {}) {
  return {
    messageId: responseBody.messages?.[0]?.id || null,
    contactWaId: responseBody.contacts?.[0]?.wa_id || null,
  };
}

function getWhatsAppConfigStatus() {
  const hasAccessToken = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
  const hasPhoneNumberId = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const hasWebhookVerifyToken = Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  const templateName = process.env.WHATSAPP_KYC_APPROVED_TEMPLATE_NAME || '';

  return {
    configured: hasAccessToken && hasPhoneNumberId,
    hasAccessToken,
    hasPhoneNumberId,
    hasWebhookVerifyToken,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91',
    messageMode: templateName ? 'template' : 'text',
    templateName: templateName || null,
    templateLanguage: process.env.WHATSAPP_KYC_APPROVED_TEMPLATE_LANGUAGE || 'en_US',
    missing: [
      !hasPhoneNumberId ? 'WHATSAPP_PHONE_NUMBER_ID' : null,
      !hasAccessToken ? 'WHATSAPP_ACCESS_TOKEN' : null,
    ].filter(Boolean),
  };
}

function sanitizeGraphError(error = {}) {
  return {
    message: error.message || null,
    type: error.type || null,
    code: error.code || null,
    errorSubcode: error.error_subcode || null,
    fbtraceId: error.fbtrace_id || null,
  };
}

async function verifyWhatsAppCredentials() {
  const config = getWhatsAppConfigStatus();
  if (!config.configured) {
    return {
      ok: false,
      config,
      reason: `Missing WhatsApp configuration: ${config.missing.join(', ')}`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.WHATSAPP_VERIFY_TIMEOUT_MS) || 10000);

  try {
    const url = `https://graph.facebook.com/${config.apiVersion}/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name,quality_rating`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        config,
        status: response.status,
        error: sanitizeGraphError(body.error || { message: `Graph API returned ${response.status}` }),
        response: body,
      };
    }

    return {
      ok: true,
      config,
      phoneNumber: {
        id: body.id || null,
        displayPhoneNumber: body.display_phone_number || null,
        verifiedName: body.verified_name || null,
        qualityRating: body.quality_rating || null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      config,
      error: {
        message: err.name === 'AbortError' ? 'WhatsApp credential verification timed out' : err.message,
        type: err.name,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWhatsAppPayload(toMobile, payloadBuilder) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
  const to = normalizeWhatsAppNumber(toMobile);

  if (!to) {
    const result = { sent: false, skipped: true, reason: 'missing_mobile' };
    console.warn('[whatsapp] notification skipped', result);
    return result;
  }

  if (!phoneNumberId || !accessToken) {
    const result = { sent: false, skipped: true, reason: 'whatsapp_not_configured', to: maskWhatsAppNumber(to) };
    console.warn('[whatsapp] notification skipped', result);
    return result;
  }

  const { mode, body } = payloadBuilder(to);
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(responseBody.error?.message || `WhatsApp send failed with status ${response.status}`);
    error.status = response.status;
    error.response = responseBody;
    error.to = maskWhatsAppNumber(to);
    error.mode = mode;
    console.error('[whatsapp] notification failed', {
      to: error.to,
      mode,
      status: response.status,
      reason: error.message,
      response: responseBody,
    });
    throw error;
  }

  const summary = summarizeWhatsAppResponse(responseBody);
  const result = {
    sent: true,
    skipped: false,
    to: maskWhatsAppNumber(to),
    mode,
    status: response.status,
    ...summary,
    response: responseBody,
  };
  console.info('[whatsapp] notification sent', {
    to: result.to,
    mode,
    status: result.status,
    messageId: result.messageId,
    contactWaId: result.contactWaId,
  });
  return result;
}

async function sendKycApprovedWhatsApp(user) {
  const name = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Customer';
  return sendWhatsAppPayload(user?.mobile, (to) => buildKycApprovedPayload(to, name));
}

module.exports = {
  buildKycApprovedMessage,
  buildKycApprovedPayload,
  getWhatsAppConfigStatus,
  maskWhatsAppNumber,
  normalizeWhatsAppNumber,
  sanitizeGraphError,
  sendKycApprovedWhatsApp,
  verifyWhatsAppCredentials,
};
