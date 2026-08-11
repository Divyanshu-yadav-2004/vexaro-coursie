'use strict';
/**
 * email.js — Vexaro KYC Professional Email Notification Service
 *
 * Templates:
 *   1. Welcome / Registration
 *   2. KYC Submitted (status → pending)
 *   3. KYC Approved  (status → approved)
 *   4. KYC Rejected  (status → rejected / action required)
 *   5. Password Reset
 *   6. Security / Login Notification
 *
 * Config via .env:
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS
 *   EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS
 *   VEXARO_PORTAL_URL, VEXARO_SUPPORT_EMAIL, VEXARO_LOGO_URL
 */

const nodemailer = require('nodemailer');

// ─── Brand constants ──────────────────────────────────────────
const BRAND = {
  orange:     '#e85d04',
  orangeDark: '#c44d03',
  blue:       '#1d3557',
  blueMid:    '#274472',
  white:      '#ffffff',
  bg:         '#f0f4f8',
  cardBg:     '#ffffff',
  border:     '#e2e8f0',
  text:       '#1e293b',
  textMuted:  '#64748b',
  success:    '#16a34a',
  successBg:  '#f0fdf4',
  successBdr: '#bbf7d0',
  danger:     '#dc2626',
  dangerBg:   '#fef2f2',
  dangerBdr:  '#fecaca',
  pending:    '#d97706',
  pendingBg:  '#fffbeb',
  pendingBdr: '#fde68a',
  infoBg:     '#eff6ff',
  infoBdr:    '#bfdbfe',
  infoText:   '#1d4ed8',
};

// ─── Config constants ─────────────────────────────────────────
const LOGO_URL =
  process.env.VEXARO_LOGO_URL ||
  'https://raw.githubusercontent.com/Divyanshu-yadav-2004/vexaro-coursie/main/assets/vexaro-logo.jpeg';

const PORTAL_URL =
  process.env.APP_BASE_URL ||
  process.env.VEXARO_PORTAL_URL ||
  'https://vexaro.co.in';

const SUPPORT_EMAIL =
  process.env.VEXARO_SUPPORT_EMAIL || 'vexarocouriersolution@gmail.com';

const CURRENT_YEAR = new Date().getFullYear();

// ─── In-memory deduplication (prevents duplicate emails in same process) ─────
const _recentlySent = new Map();
const DEDUPE_WINDOW_MS = 30 * 1000; // 30 seconds

function isDuplicate(key) {
  if (!key) return false;
  const lastSent = _recentlySent.get(key);
  if (lastSent && Date.now() - lastSent < DEDUPE_WINDOW_MS) return true;
  _recentlySent.set(key, Date.now());
  // Clean up old entries to avoid memory leak
  if (_recentlySent.size > 500) {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS * 2;
    for (const [k, ts] of _recentlySent) {
      if (ts < cutoff) _recentlySent.delete(k);
    }
  }
  return false;
}

// ─── Transporter factory ──────────────────────────────────────
function createTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const rawPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
  const pass = rawPass.replace(/\s+/g, '');
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '465', 10);
  const secureStr = process.env.SMTP_SECURE || process.env.EMAIL_SECURE;
  const secure = secureStr !== undefined ? secureStr !== 'false' : port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

function getFromAddress() {
  const name = process.env.SMTP_FROM_NAME || process.env.EMAIL_FROM_NAME || 'Vexaro';
  const addr = process.env.SMTP_FROM_EMAIL || process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || process.env.EMAIL_USER || SUPPORT_EMAIL;
  return `"${name}" <${addr}>`;
}

// ─── Utility helpers ──────────────────────────────────────────
function formatDate(date) {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function formatDateTime(date) {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  }) + ' IST';
}

function formatAppId(userId) {
  return `VX-${String(userId || '').padStart(6, '0')}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Shared base layout ───────────────────────────────────────
function baseLayout({ preheader = '', headerSubtitle = 'KYC Portal', body = '' } = {}) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no">
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <title>Vexaro — KYC Portal</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
    @media only screen and (max-width: 620px) {
      .email-wrapper { width: 100% !important; border-radius: 0 !important; }
      .content-cell { padding: 24px 16px !important; }
      .status-badge { font-size: 11px !important; padding: 5px 14px !important; }
      .cta-btn { width: 100% !important; }
      .cta-btn td { display: block !important; width: 100% !important; }
      .cta-btn a { display: block !important; padding: 15px 20px !important; font-size: 15px !important; text-align: center !important; }
      .info-card-cell { padding: 10px 12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:Arial,Helvetica,'Segoe UI',sans-serif;">

  <!-- Preheader (invisible preview text) -->
  <div style="display:none;font-size:1px;color:${BRAND.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
         style="background-color:${BRAND.bg};padding:24px 12px;">
    <tr>
      <td align="center">

        <!-- Email card -->
        <table class="email-wrapper" role="presentation" cellspacing="0" cellpadding="0" border="0"
               width="600" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;
               box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- ── HEADER ────────────────────────────────────────── -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.blue} 0%,${BRAND.blueMid} 60%,#1a4a80 100%);
                       padding:24px 28px 20px;text-align:center;">
              <!-- Logo -->
              <a href="${PORTAL_URL}" target="_blank" style="display:inline-block;">
                <img src="${LOGO_URL}"
                     alt="Vexaro Courier Solution Private Limited"
                     width="180" height="60"
                     style="max-width:180px;height:auto;display:block;margin:0 auto;
                            background:${BRAND.white};border-radius:8px;padding:7px 14px;">
              </a>
              <!-- Subtitle -->
              <p style="margin:10px 0 0;font-size:11px;color:rgba(255,255,255,0.70);
                        letter-spacing:2px;text-transform:uppercase;font-weight:700;">
                ${escapeHtml(headerSubtitle)}
              </p>
            </td>
          </tr>

          <!-- ── BODY ──────────────────────────────────────────── -->
          <tr>
            <td class="content-cell"
                style="background:${BRAND.cardBg};padding:32px 36px;">
              ${body}
            </td>
          </tr>

          <!-- ── FOOTER ─────────────────────────────────────────── -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid ${BRAND.border};
                       padding:22px 32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:${BRAND.textMuted};font-weight:600;">
                Need help?
              </p>
              <p style="margin:0 0 16px;font-size:13px;color:${BRAND.textMuted};line-height:1.6;">
                Contact Vexaro Support at
                <a href="mailto:${SUPPORT_EMAIL}"
                   style="color:${BRAND.orange};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr><td style="border-top:1px solid ${BRAND.border};padding-top:14px;"></td></tr>
              </table>
              <p style="margin:12px 0 2px;font-size:15px;font-weight:800;color:${BRAND.blue};
                        letter-spacing:1px;">VEXARO</p>
              <p style="margin:0 0 8px;font-size:10px;color:${BRAND.textMuted};letter-spacing:1.5px;
                        text-transform:uppercase;">Courier Solution Private Limited</p>
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                &copy; ${CURRENT_YEAR} Vexaro Courier Solution Private Limited. All rights reserved.<br>
                Vexaro KYC Portal &nbsp;|&nbsp; India
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;line-height:1.5;
                        border-top:1px solid #e2e8f0;padding-top:12px;">
                This is an automated email. Please do not reply directly to this message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Shared building blocks ───────────────────────────────────
function statusBadge(label, bgColor, textColor, borderColor) {
  return `<span class="status-badge"
    style="display:inline-block;background:${bgColor};color:${textColor};
           border:1.5px solid ${borderColor};border-radius:20px;
           padding:6px 20px;font-size:12px;font-weight:700;letter-spacing:1.5px;
           text-transform:uppercase;">${label}</span>`;
}

function statusIcon(emoji, bgColor) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 20px;">
    <tr>
      <td style="width:68px;height:68px;border-radius:50%;background:${bgColor};
                 text-align:center;vertical-align:middle;font-size:32px;line-height:68px;
                 box-shadow:0 4px 16px rgba(0,0,0,0.08);">
        ${emoji}
      </td>
    </tr>
  </table>`;
}

function infoCard(rows = []) {
  const cells = rows.map(([label, value], idx) => {
    const isLast = idx === rows.length - 1;
    const borderStyle = isLast ? '' : `border-bottom:1px solid ${BRAND.border};`;
    return `
    <tr>
      <td class="info-card-cell"
          style="padding:12px 16px;font-size:12px;color:${BRAND.textMuted};font-weight:600;
                 ${borderStyle}white-space:nowrap;width:42%;vertical-align:middle;">
        ${label}
      </td>
      <td class="info-card-cell"
          style="padding:12px 16px;font-size:14px;color:${BRAND.text};font-weight:600;
                 ${borderStyle}text-align:right;vertical-align:middle;">
        ${value}
      </td>
    </tr>`;
  }).join('');

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
         class="info-table"
         style="border:1px solid ${BRAND.border};border-radius:10px;overflow:hidden;
                background:#ffffff;margin:22px 0;">
    <thead>
      <tr>
        <td colspan="2"
            style="background:linear-gradient(90deg,${BRAND.blue},${BRAND.blueMid});padding:11px 16px;">
          <span style="font-size:11px;color:#ffffff;font-weight:700;
                       letter-spacing:1.2px;text-transform:uppercase;">Application Details</span>
        </td>
      </tr>
    </thead>
    <tbody>${cells}</tbody>
  </table>`;
}

function ctaButton(label = 'View Application', url = PORTAL_URL) {
  return `
  <table class="cta-btn" role="presentation" cellspacing="0" cellpadding="0" border="0"
         style="margin:28px auto 0;">
    <tr>
      <td align="center" style="border-radius:8px;background:${BRAND.orange};">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
          href="${url}" style="height:50px;v-text-anchor:middle;width:220px;" arcsize="14%"
          strokecolor="${BRAND.orangeDark}" fillcolor="${BRAND.orange}">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">
            ${label}
          </center>
        </v:roundrect>
        <![endif]-->
        <a href="${url}" target="_blank" mso-hide="all"
           style="display:inline-block;padding:15px 44px;font-size:15px;font-weight:700;
                  color:#ffffff;text-decoration:none;border-radius:8px;
                  background:${BRAND.orange};font-family:Arial,sans-serif;letter-spacing:0.4px;">
          ${label} &rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

function sectionHeading(text, color = BRAND.blue) {
  return `<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${color};
    font-family:Arial,Helvetica,sans-serif;line-height:1.3;">${text}</h2>`;
}

function divider() {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
    style="margin:24px 0;">
    <tr><td style="border-top:1px solid ${BRAND.border};"></td></tr>
  </table>`;
}

function infoBox(content, bgColor, borderColor, textColor) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
     style="background:${bgColor};border:1.5px solid ${borderColor};border-radius:8px;margin:16px 0;">
    <tr>
      <td style="padding:14px 18px;font-size:13px;color:${textColor};line-height:1.7;">
        ${content}
      </td>
    </tr>
  </table>`;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1 — WELCOME / REGISTRATION
// ═══════════════════════════════════════════════════════════════
function buildWelcomeHtml({ name, userId }) {
  const appId = formatAppId(userId);
  const fullName = escapeHtml(name || 'Applicant');

  const body = `
    <!-- Welcome Icon -->
    ${statusIcon('👋', BRAND.infoBg)}

    <!-- Title -->
    <div style="text-align:center;margin-bottom:24px;">
      ${sectionHeading('Welcome to Vexaro!', BRAND.blue)}
      <p style="margin:6px 0 0;font-size:14px;color:${BRAND.textMuted};">
        Your account has been created successfully.
      </p>
    </div>

    ${divider()}

    <!-- Greeting -->
    <p style="margin:0 0 14px;font-size:16px;color:${BRAND.text};font-weight:600;">
      Hello ${fullName},
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
      Welcome to the <strong>Vexaro KYC Portal</strong>. We're delighted to have you on board.
      Your account has been successfully created and is ready for use.
    </p>
    <p style="margin:0;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
      To start using Vexaro Courier services, please complete your KYC verification by uploading
      the required identity documents. This helps us verify your identity and activate your account.
    </p>

    ${infoCard([
      ['Account ID', `<strong style="color:${BRAND.orange};font-family:monospace;font-size:15px;">${appId}</strong>`],
      ['Name', fullName],
      ['Status', `<span style="color:${BRAND.pending};font-weight:700;">KYC Pending</span>`],
      ['Registered On', formatDate(new Date())],
    ])}

    <!-- What to do next -->
    ${infoBox(`
      <strong style="color:${BRAND.infoText};">&#9432;&nbsp; Next Steps</strong><br>
      <ol style="margin:8px 0 0;padding-left:20px;color:${BRAND.textMuted};line-height:1.9;">
        <li>Log in to the Vexaro KYC Portal</li>
        <li>Upload your Aadhaar Card (Front &amp; Back)</li>
        <li>Upload your PAN Card</li>
        <li>Upload your Bank Passbook</li>
        <li>Submit and await verification (1–3 business days)</li>
      </ol>
    `, BRAND.infoBg, BRAND.infoBdr, BRAND.infoText)}

    <!-- CTA -->
    ${ctaButton('Complete KYC Verification', PORTAL_URL)}`;

  return baseLayout({
    preheader: `Welcome to Vexaro, ${name}! Complete your KYC to start using our services.`,
    headerSubtitle: 'KYC Portal',
    body,
  });
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2 — KYC SUBMITTED
// ═══════════════════════════════════════════════════════════════
function buildKycSubmittedHtml({ name, userId, submittedAt }) {
  const appId = formatAppId(userId);
  const dateStr = formatDate(submittedAt);
  const fullName = escapeHtml(name || 'Applicant');

  const body = `
    ${statusIcon('📋', BRAND.pendingBg)}

    <div style="text-align:center;margin-bottom:24px;">
      ${sectionHeading('KYC Application Submitted', BRAND.blue)}
      <p style="margin:6px 0 12px;font-size:14px;color:${BRAND.textMuted};">
        Your documents are now under review
      </p>
      ${statusBadge('UNDER REVIEW', BRAND.pendingBg, BRAND.pending, BRAND.pendingBdr)}
    </div>

    ${divider()}

    <p style="margin:0 0 14px;font-size:16px;color:${BRAND.text};font-weight:600;">
      Hello ${fullName},
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
      Thank you for submitting your KYC application on the <strong>Vexaro KYC Portal</strong>.
      Your documents have been received and are currently queued for verification.
    </p>
    <p style="margin:0;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
      Our team will review your application and notify you once a decision has been made.
      This typically takes <strong>1–3 business days</strong>.
    </p>

    ${infoCard([
      ['Application ID', `<strong style="color:${BRAND.orange};font-family:monospace;font-size:15px;">${appId}</strong>`],
      ['Applicant Name', fullName],
      ['Status', `<span style="color:${BRAND.pending};font-weight:700;">Under Review</span>`],
      ['Submitted On', dateStr],
    ])}

    ${ctaButton('View Application Status')}

    ${divider()}

    ${infoBox(`
      <strong>&#9432;&nbsp; What happens next?</strong><br>
      You will receive an email notification once your KYC is approved or if any corrections
      are needed. You may also log in to check your application status at any time.
    `, BRAND.infoBg, BRAND.infoBdr, BRAND.infoText)}`;

  return baseLayout({
    preheader: `KYC application ${appId} submitted and under review.`,
    headerSubtitle: 'KYC Portal',
    body,
  });
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3 — KYC APPROVED
// ═══════════════════════════════════════════════════════════════
function buildKycApprovedHtml({ name, userId, submittedAt, reviewedAt }) {
  const appId = formatAppId(userId);
  const submittedStr = formatDate(submittedAt);
  const reviewedStr = formatDate(reviewedAt);
  const fullName = escapeHtml(name || 'Applicant');

  const body = `
    ${statusIcon('✅', BRAND.successBg)}

    <div style="text-align:center;margin-bottom:24px;">
      ${sectionHeading('KYC Verification Approved', BRAND.success)}
      <p style="margin:6px 0 12px;font-size:14px;color:${BRAND.textMuted};">
        Congratulations — your identity has been verified.
      </p>
      ${statusBadge('APPROVED', BRAND.successBg, BRAND.success, BRAND.successBdr)}
    </div>

    ${divider()}

    <p style="margin:0 0 14px;font-size:16px;color:${BRAND.text};font-weight:600;">
      Hello ${fullName},
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
      Great news! Your KYC application has been <strong>successfully reviewed and approved</strong>
      by the Vexaro verification team. Your account is now fully verified and active.
    </p>
    <p style="margin:0;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
      You can now access all features of the Vexaro Courier platform. Welcome aboard!
    </p>

    ${infoCard([
      ['Application ID', `<strong style="color:${BRAND.orange};font-family:monospace;font-size:15px;">${appId}</strong>`],
      ['Applicant Name', fullName],
      ['Status', `<span style="color:${BRAND.success};font-weight:700;">&#10003; Approved</span>`],
      ['Submitted On', submittedStr],
      ['Approved On', `<strong>${reviewedStr}</strong>`],
    ])}

    ${ctaButton('Access Your Account')}

    ${divider()}

    ${infoBox(`
      <strong style="color:${BRAND.success};">&#10003;&nbsp; Your account is now fully active</strong><br>
      All Vexaro Courier services are now available to you. Log in to the portal
      to manage your account and start using our services.
    `, BRAND.successBg, BRAND.successBdr, BRAND.success)}`;

  return baseLayout({
    preheader: `Your KYC application ${appId} has been approved. Your account is now active!`,
    headerSubtitle: 'KYC Portal',
    body,
  });
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 4 — KYC REJECTED / ACTION REQUIRED
// ═══════════════════════════════════════════════════════════════
function buildKycRejectedHtml({ name, userId, submittedAt, reviewedAt, rejectionReason }) {
  const appId = formatAppId(userId);
  const submittedStr = formatDate(submittedAt);
  const reviewedStr = formatDate(reviewedAt);
  const fullName = escapeHtml(name || 'Applicant');
  const reason = escapeHtml(rejectionReason || 'Please contact Vexaro Support for details.');

  const body = `
    ${statusIcon('⚠️', BRAND.dangerBg)}

    <div style="text-align:center;margin-bottom:24px;">
      ${sectionHeading('KYC Update — Action Required', BRAND.danger)}
      <p style="margin:6px 0 12px;font-size:14px;color:${BRAND.textMuted};">
        Your application requires attention
      </p>
      ${statusBadge('ACTION REQUIRED', BRAND.dangerBg, BRAND.danger, BRAND.dangerBdr)}
    </div>

    ${divider()}

    <p style="margin:0 0 14px;font-size:16px;color:${BRAND.text};font-weight:600;">
      Hello ${fullName},
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
      After reviewing your KYC application, our verification team was unable to approve it
      at this time. Please see the details below and re-submit the corrected documents.
    </p>

    ${infoCard([
      ['Application ID', `<strong style="color:${BRAND.orange};font-family:monospace;font-size:15px;">${appId}</strong>`],
      ['Applicant Name', fullName],
      ['Status', `<span style="color:${BRAND.danger};font-weight:700;">&#x2715; Rejected</span>`],
      ['Submitted On', submittedStr],
      ['Reviewed On', reviewedStr],
    ])}

    <!-- Rejection Reason -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background:${BRAND.dangerBg};border:1.5px solid ${BRAND.dangerBdr};
                  border-radius:8px;margin:16px 0 0;overflow:hidden;">
      <tr>
        <td style="background:${BRAND.danger};padding:9px 18px;">
          <span style="font-size:10px;color:#ffffff;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">
            &#9888;&nbsp; Reason for Rejection
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0;font-size:14px;color:${BRAND.text};line-height:1.75;font-style:italic;">
            &ldquo;${reason}&rdquo;
          </p>
        </td>
      </tr>
    </table>

    <!-- What to do next -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background:#fff8f0;border:1.5px solid #fed7aa;border-radius:8px;margin:16px 0 0;overflow:hidden;">
      <tr>
        <td style="background:${BRAND.orange};padding:9px 18px;">
          <span style="font-size:10px;color:#ffffff;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">
            &#8594;&nbsp; What to Do Next
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;">
          <ol style="margin:0;padding-left:20px;font-size:14px;color:${BRAND.textMuted};line-height:1.9;">
            <li>Log in to the Vexaro Portal</li>
            <li>Review the rejection reason above carefully</li>
            <li>Prepare the corrected documents or information</li>
            <li>Re-submit your KYC application</li>
          </ol>
        </td>
      </tr>
    </table>

    ${ctaButton('Re-submit KYC Application')}

    ${divider()}

    <p style="margin:0;font-size:13px;color:${BRAND.textMuted};line-height:1.6;text-align:center;">
      If you believe this decision is incorrect or need assistance,<br>
      please contact us at
      <a href="mailto:${SUPPORT_EMAIL}"
         style="color:${BRAND.orange};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
    </p>`;

  return baseLayout({
    preheader: `Important update on your Vexaro KYC application ${appId}. Action required.`,
    headerSubtitle: 'KYC Portal',
    body,
  });
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 5 — PASSWORD RESET
// ═══════════════════════════════════════════════════════════════
function buildPasswordResetHtml({ name, resetUrl, expiresInMinutes = 60 }) {
  const fullName = escapeHtml(name || 'User');
  const safeUrl = resetUrl || PORTAL_URL;

  const body = `
    ${statusIcon('🔐', BRAND.infoBg)}

    <div style="text-align:center;margin-bottom:24px;">
      ${sectionHeading('Reset Your Password', BRAND.blue)}
      <p style="margin:6px 0 0;font-size:14px;color:${BRAND.textMuted};">
        We received a request to reset your password
      </p>
    </div>

    ${divider()}

    <p style="margin:0 0 14px;font-size:16px;color:${BRAND.text};font-weight:600;">
      Hello ${fullName},
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
      We received a request to reset the password for your Vexaro account.
      Click the button below to create a new password. This link is valid for
      <strong>${expiresInMinutes} minutes</strong>.
    </p>

    ${ctaButton('Reset My Password', safeUrl)}

    ${divider()}

    ${infoBox(`
      <strong>&#9432;&nbsp; Didn't request this?</strong><br>
      If you did not request a password reset, please ignore this email.
      Your password will remain unchanged. For security concerns, contact
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.orange};font-weight:600;">${SUPPORT_EMAIL}</a>.
    `, BRAND.infoBg, BRAND.infoBdr, BRAND.infoText)}

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
      This link will expire in ${expiresInMinutes} minutes.<br>
      Never share this link with anyone.
    </p>`;

  return baseLayout({
    preheader: `Reset your Vexaro password — link expires in ${expiresInMinutes} minutes.`,
    headerSubtitle: 'Account Security',
    body,
  });
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 6 — SECURITY / LOGIN NOTIFICATION
// ═══════════════════════════════════════════════════════════════
function buildSecurityNotificationHtml({ name, event = 'Login', eventTime, deviceInfo = null }) {
  const fullName = escapeHtml(name || 'User');
  const timeStr = formatDateTime(eventTime || new Date());
  const safeEvent = escapeHtml(event);

  const deviceRow = deviceInfo
    ? `<tr>
        <td style="padding:10px 16px;font-size:11px;color:${BRAND.textMuted};font-weight:700;
                   text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${BRAND.border};
                   white-space:nowrap;width:40%;background:#f8fafc;">Device / Browser</td>
        <td style="padding:10px 16px;font-size:14px;color:${BRAND.text};font-weight:600;
                   border-bottom:1px solid ${BRAND.border};">${escapeHtml(deviceInfo)}</td>
      </tr>`
    : '';

  const body = `
    ${statusIcon('🔔', BRAND.pendingBg)}

    <div style="text-align:center;margin-bottom:24px;">
      ${sectionHeading('Security Notification', BRAND.blue)}
      <p style="margin:6px 0 0;font-size:14px;color:${BRAND.textMuted};">
        A security event occurred on your Vexaro account
      </p>
    </div>

    ${divider()}

    <p style="margin:0 0 14px;font-size:16px;color:${BRAND.text};font-weight:600;">
      Hello ${fullName},
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
      We detected a security event on your Vexaro account. The details are provided below.
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="border:1.5px solid ${BRAND.border};border-radius:8px;overflow:hidden;margin:22px 0;">
      <thead>
        <tr>
          <td colspan="2"
              style="background:linear-gradient(90deg,${BRAND.blue},${BRAND.blueMid});padding:9px 16px;">
            <span style="font-size:10px;color:rgba(255,255,255,0.85);font-weight:700;
                         letter-spacing:1.2px;text-transform:uppercase;">Security Event Details</span>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:10px 16px;font-size:11px;color:${BRAND.textMuted};font-weight:700;
                     text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${BRAND.border};
                     white-space:nowrap;width:40%;background:#f8fafc;">Event</td>
          <td style="padding:10px 16px;font-size:14px;color:${BRAND.text};font-weight:600;
                     border-bottom:1px solid ${BRAND.border};">${safeEvent}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:11px;color:${BRAND.textMuted};font-weight:700;
                     text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${BRAND.border};
                     white-space:nowrap;background:#f8fafc;">Account</td>
          <td style="padding:10px 16px;font-size:14px;color:${BRAND.text};font-weight:600;
                     border-bottom:1px solid ${BRAND.border};">${fullName}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-size:11px;color:${BRAND.textMuted};font-weight:700;
                     text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid ${BRAND.border};
                     white-space:nowrap;background:#f8fafc;">Date &amp; Time</td>
          <td style="padding:10px 16px;font-size:14px;color:${BRAND.text};font-weight:600;
                     border-bottom:1px solid ${BRAND.border};">${timeStr}</td>
        </tr>
        ${deviceRow}
      </tbody>
    </table>

    ${infoBox(`
      <strong style="color:${BRAND.infoText};">&#9432;&nbsp; Was this you?</strong><br>
      If you performed this action, no further steps are required. If you do not
      recognise this activity, please contact our support team immediately at
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.orange};font-weight:600;">${SUPPORT_EMAIL}</a>.
    `, BRAND.infoBg, BRAND.infoBdr, BRAND.infoText)}

    ${ctaButton('Visit Portal', PORTAL_URL)}`;

  return baseLayout({
    preheader: `Security alert: ${event} detected on your Vexaro account at ${timeStr}.`,
    headerSubtitle: 'Security Alert',
    body,
  });
}

// ─── System test template ─────────────────────────────────────
function buildSystemTestHtml(toEmail) {
  return baseLayout({
    preheader: 'Vexaro email system test — SMTP working correctly',
    headerSubtitle: 'Email System Test',
    body: `
      <p style="margin:0 0 18px;font-size:16px;color:${BRAND.text};font-weight:600;">Hello,</p>
      <p style="margin:0 0 18px;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
        This is a test email from Vexaro Courier Solution Private Limited. It confirms that
        the SMTP configuration and email delivery pipeline are working correctly.
      </p>
      ${infoCard([
        ['Recipient', escapeHtml(toEmail)],
        ['Tested At', formatDateTime(new Date())],
        ['Status', `<span style="color:${BRAND.success};font-weight:700;">&#10003; Delivery Confirmed</span>`],
      ])}
      <p style="margin:0;font-size:14px;color:${BRAND.textMuted};line-height:1.75;">
        If you received this email, the Vexaro email system is fully operational.
      </p>`,
  });
}

// ─── Core send helper ─────────────────────────────────────────
async function sendEmail({ to, subject, html, dedupeKey = null }) {
  if (dedupeKey && isDuplicate(dedupeKey)) {
    console.info('[email] deduplicated — suppressed repeat send', { to, subject, dedupeKey });
    return { sent: false, skipped: true, reason: 'deduplicated' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] skipped — SMTP credentials not configured in environment');
    return { sent: false, skipped: true, reason: 'email_not_configured' };
  }

  const mailOptions = {
    from: getFromAddress(),
    to,
    subject,
    html,
    headers: {
      'X-Mailer': 'Vexaro KYC Portal',
      'X-Priority': '3',
    },
  };

  let attempts = 0;
  const maxAttempts = 2;
  let lastError = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const info = await transporter.sendMail(mailOptions);
      console.info('[email] sent ✓', { to, subject, messageId: info.messageId, attempt: attempts });
      return { sent: true, skipped: false, messageId: info.messageId };
    } catch (err) {
      lastError = err;
      console.warn(`[email] send attempt ${attempts} failed for ${to}: ${err.message}`);
      if (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  console.error('[email] delivery failed after max attempts', { to, subject, error: lastError?.message });
  return { sent: false, skipped: false, error: lastError?.message || 'SMTP delivery failed' };
}

// ─── Public send functions ────────────────────────────────────

async function sendWelcomeEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };
  const userId = user.id || user.userId;
  const name = user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  const html = buildWelcomeHtml({ name, userId });
  return sendEmail({
    to: user.email,
    subject: `Welcome to Vexaro — Your Account Has Been Created`,
    html,
    dedupeKey: `welcome:${userId}:${user.email}`,
  });
}

async function sendKycSubmittedEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };
  const userId = user.id || user.userId;
  // Use kycId (application ID) for dedupe when available — avoids blocking resubmissions
  const kycId = user.kycId || user.kyc_id || null;
  const name = user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  const html = buildKycSubmittedHtml({ name, userId, submittedAt: user.submittedAt || new Date() });
  const dedupeKey = kycId
    ? `kyc-submitted:${kycId}`
    : `kyc-submitted:${userId}:${user.email}:${Math.floor(Date.now() / 60000)}`;
  return sendEmail({
    to: user.email,
    subject: `Vexaro KYC Submission Confirmed — Application ${formatAppId(userId)}`,
    html,
    dedupeKey,
  });
}

async function sendKycApprovedEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };
  const userId = user.id || user.userId;
  // Dedupe by kycId (application ID) — prevents double-email for same approval
  const kycId = user.kycId || user.kyc_id || null;
  const name = user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  const html = buildKycApprovedHtml({
    name, userId,
    submittedAt: user.submittedAt,
    reviewedAt: user.reviewedAt || new Date(),
  });
  const dedupeKey = kycId
    ? `kyc-approved:${kycId}`
    : `kyc-approved:${userId}:${user.email}`;
  return sendEmail({
    to: user.email,
    subject: `Vexaro KYC Approved — Application ${formatAppId(userId)}`,
    html,
    dedupeKey,
  });
}

async function sendKycRejectedEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };
  const userId = user.id || user.userId;
  // Dedupe by kycId — each rejection decision has its own application ID
  const kycId = user.kycId || user.kyc_id || null;
  const name = user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  const html = buildKycRejectedHtml({
    name, userId,
    submittedAt: user.submittedAt,
    reviewedAt: user.reviewedAt || new Date(),
    rejectionReason: user.rejectionReason,
  });
  const dedupeKey = kycId
    ? `kyc-rejected:${kycId}`
    : `kyc-rejected:${userId}:${user.email}`;
  return sendEmail({
    to: user.email,
    subject: `Action Required — Update Your Vexaro KYC — Application ${formatAppId(userId)}`,
    html,
    dedupeKey,
  });
}

async function sendPasswordResetEmail(user, resetUrl, expiresInMinutes = 60) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };
  const name = user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  const html = buildPasswordResetHtml({ name, resetUrl, expiresInMinutes });
  return sendEmail({
    to: user.email,
    subject: `Reset Your Vexaro Password`,
    html,
    dedupeKey: `pwd-reset:${user.email}:${Math.floor(Date.now() / 60000)}`,
  });
}

async function sendSecurityNotificationEmail(user, eventDetails = {}) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };
  const name = user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
  const eventLabel = eventDetails.event || 'Account Login';
  const html = buildSecurityNotificationHtml({
    name,
    event: eventLabel,
    eventTime: eventDetails.eventTime || new Date(),
    deviceInfo: eventDetails.deviceInfo || null,
  });
  // Dedupe per user + event label + 30s bucket (prevents duplicate on rapid double-login)
  return sendEmail({
    to: user.email,
    subject: `Vexaro Security Notification — ${eventLabel}`,
    html,
    dedupeKey: `security:${user.email}:${eventLabel}:${Math.floor(Date.now() / 30000)}`,
  });
}

async function sendSystemTestEmail(toEmail) {
  if (!toEmail) return { sent: false, skipped: true, reason: 'missing_recipient' };
  return sendEmail({
    to: toEmail,
    subject: 'Vexaro — Email System Test',
    html: buildSystemTestHtml(toEmail),
  });
}

// ─── Module exports ───────────────────────────────────────────
module.exports = {
  // Send functions
  sendWelcomeEmail,
  sendKycSubmittedEmail,
  sendKycApprovedEmail,
  sendKycRejectedEmail,
  sendPasswordResetEmail,
  sendSecurityNotificationEmail,
  sendSystemTestEmail,
  // HTML builders (for preview endpoint / unit tests)
  buildWelcomeHtml,
  buildKycSubmittedHtml,
  buildKycApprovedHtml,
  buildKycRejectedHtml,
  buildPasswordResetHtml,
  buildSecurityNotificationHtml,
};
