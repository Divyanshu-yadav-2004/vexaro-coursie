'use strict';
/**
 * email.js — Vexaro KYC Premium Email Notification Service
 *
 * Sends transactional emails for KYC lifecycle events:
 *   • KYC Submitted   (status → pending)
 *   • KYC Approved    (status → approved)
 *   • KYC Rejected    (status → rejected)
 *
 * Config via env:
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS
 *   EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS
 *   VEXARO_PORTAL_URL   (link in CTA button)
 *   VEXARO_SUPPORT_EMAIL
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

// Logo: GitHub raw URL (renders reliably in all email clients)
const LOGO_URL =
  process.env.VEXARO_LOGO_URL ||
  'https://raw.githubusercontent.com/Divyanshu-yadav-2004/vexaro-coursie/main/assets/vexaro-logo.jpeg';

const PORTAL_URL =
  process.env.VEXARO_PORTAL_URL || 'https://vexaro.co.in';

const SUPPORT_EMAIL =
  process.env.VEXARO_SUPPORT_EMAIL || 'support@vexaro.co.in';

// ─── Transporter factory ──────────────────────────────────────
function createTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const secure = process.env.EMAIL_SECURE === 'true';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

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
  const name = process.env.EMAIL_FROM_NAME || 'Vexaro KYC Portal';
  const addr = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || SUPPORT_EMAIL;
  return `"${name}" <${addr}>`;
}

// ─── Date formatter ───────────────────────────────────────────
function formatDate(date) {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

// ─── Application ID formatter ─────────────────────────────────
function formatAppId(userId) {
  const padded = String(userId || '').padStart(6, '0');
  return `VX-${padded}`;
}

// ─── Shared base layout ───────────────────────────────────────
/**
 * Wraps content in the consistent Vexaro email shell:
 * outer bg → centered container → header → {content} → footer
 */
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
  <title>Vexaro KYC Notification</title>
  <style type="text/css">
    /* Email client resets */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    /* Outlook button fix */
    .btn-outlook a { background: ${BRAND.orange} !important; color: #ffffff !important; }
    /* Mobile */
    @media only screen and (max-width: 620px) {
      .email-wrapper { width: 100% !important; }
      .content-cell { padding: 28px 20px !important; }
      .info-table td { display: block; width: 100% !important; padding: 6px 0 !important; }
      .info-label { font-size: 11px !important; }
      .info-value { font-size: 14px !important; }
      .status-badge { font-size: 11px !important; padding: 5px 14px !important; }
      .cta-btn a { padding: 14px 32px !important; font-size: 15px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:Arial,Helvetica,'Segoe UI',sans-serif;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;font-size:1px;color:${BRAND.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">

        <!-- Email card -->
        <table class="email-wrapper" role="presentation" cellspacing="0" cellpadding="0" border="0"
               width="600" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;
               box-shadow:0 8px 40px rgba(0,0,0,0.12),0 2px 8px rgba(0,0,0,0.08);">

          <!-- ── HEADER ─────────────────────────────────────── -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.blue} 0%,${BRAND.blueMid} 60%,#1a4a80 100%);
                       padding:32px 40px 24px;text-align:center;">
              <!-- Logo -->
              <a href="${PORTAL_URL}" target="_blank" style="display:inline-block;">
                <img src="${LOGO_URL}" alt="Vexaro Courier Solution Private Limited"
                     width="180" height="auto"
                     style="max-width:180px;height:auto;display:block;margin:0 auto;
                            background:${BRAND.white};border-radius:10px;padding:8px 12px;">
              </a>
              <!-- Tagline -->
              <p style="margin:12px 0 0;font-size:12px;color:rgba(255,255,255,0.70);
                        letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">
                ${headerSubtitle}
              </p>
            </td>
          </tr>

          <!-- ── BODY ──────────────────────────────────────── -->
          <tr>
            <td class="content-cell" style="background:${BRAND.cardBg};padding:40px 48px;">
              ${body}
            </td>
          </tr>

          <!-- ── FOOTER ────────────────────────────────────── -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid ${BRAND.border};
                       padding:24px 40px;text-align:center;">
              <!-- Support -->
              <p style="margin:0 0 6px;font-size:13px;color:${BRAND.textMuted};font-weight:600;">
                Need help?
              </p>
              <p style="margin:0 0 16px;font-size:13px;color:${BRAND.textMuted};line-height:1.6;">
                Contact Vexaro Support at
                <a href="mailto:${SUPPORT_EMAIL}"
                   style="color:${BRAND.orange};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
              </p>
              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr><td style="border-top:1px solid ${BRAND.border};padding-top:16px;"></td></tr>
              </table>
              <!-- Brand name -->
              <p style="margin:12px 0 4px;font-size:16px;font-weight:700;color:${BRAND.blue};
                        letter-spacing:0.5px;">
                VEXARO
              </p>
              <p style="margin:0 0 10px;font-size:11px;color:${BRAND.textMuted};letter-spacing:1px;">
                SECURE &nbsp;•&nbsp; RELIABLE &nbsp;•&nbsp; PROFESSIONAL
              </p>
              <!-- Legal -->
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                &copy; ${new Date().getFullYear()} Vexaro Courier Solution Private Limited. All rights reserved.<br>
                Vexaro KYC Portal &nbsp;|&nbsp; India
              </p>
              <!-- Disclaimer -->
              <p style="margin:12px 0 0;font-size:11px;color:#94a3b8;line-height:1.5;
                        border-top:1px solid #e2e8f0;padding-top:12px;">
                This is an automated notification from the Vexaro KYC system.
                Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Status badge ─────────────────────────────────────────────
function statusBadge(label, bgColor, textColor, borderColor) {
  return `<span class="status-badge" style="display:inline-block;background:${bgColor};
    color:${textColor};border:1.5px solid ${borderColor};border-radius:20px;
    padding:6px 18px;font-size:12px;font-weight:700;letter-spacing:1.5px;
    text-transform:uppercase;">${label}</span>`;
}

// ─── Status icon circle ───────────────────────────────────────
function statusIcon(emoji, bgColor) {
  return `<div style="width:72px;height:72px;border-radius:50%;background:${bgColor};
    display:inline-flex;align-items:center;justify-content:center;
    font-size:34px;margin:0 auto;line-height:1;
    box-shadow:0 4px 16px rgba(0,0,0,0.12);">
    ${emoji}
  </div>`;
}

// ─── Info card (Application Details) ─────────────────────────
function infoCard(rows = []) {
  const cells = rows.map(([label, value]) => `
    <tr>
      <td class="info-label" style="padding:10px 16px;font-size:12px;color:${BRAND.textMuted};
          font-weight:600;text-transform:uppercase;letter-spacing:0.8px;
          border-bottom:1px solid ${BRAND.border};white-space:nowrap;width:42%;">
        ${label}
      </td>
      <td class="info-value" style="padding:10px 16px;font-size:14px;color:${BRAND.text};
          font-weight:600;border-bottom:1px solid ${BRAND.border};">
        ${value}
      </td>
    </tr>`).join('');

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
         class="info-table"
         style="border:1.5px solid ${BRAND.border};border-radius:10px;overflow:hidden;
                background:#f8fafc;margin:24px 0;">
    <thead>
      <tr>
        <td colspan="2" style="background:linear-gradient(90deg,${BRAND.blue},${BRAND.blueMid});
            padding:10px 16px;">
          <span style="font-size:11px;color:rgba(255,255,255,0.85);font-weight:700;
                       letter-spacing:1px;text-transform:uppercase;">Application Details</span>
        </td>
      </tr>
    </thead>
    <tbody>${cells}</tbody>
  </table>`;
}

// ─── CTA Button ───────────────────────────────────────────────
function ctaButton(label = 'View Application', url = PORTAL_URL) {
  return `
  <table class="cta-btn" role="presentation" cellspacing="0" cellpadding="0" border="0"
         style="margin:28px auto 0;">
    <tr>
      <td align="center" style="border-radius:8px;background:${BRAND.orange};">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
          href="${url}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="15%"
          strokecolor="${BRAND.orangeDark}" fillcolor="${BRAND.orange}">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">
            ${label}
          </center>
        </v:roundrect>
        <![endif]-->
        <a href="${url}" target="_blank"
           style="display:inline-block;padding:15px 44px;font-size:15px;font-weight:700;
                  color:#ffffff;text-decoration:none;border-radius:8px;
                  background:${BRAND.orange};font-family:Arial,sans-serif;
                  letter-spacing:0.3px;
                  mso-hide:all;">
          ${label} &rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

// ─── Section heading ──────────────────────────────────────────
function sectionHeading(text, color = BRAND.blue) {
  return `<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${color};
    font-family:Arial,Helvetica,sans-serif;line-height:1.3;">${text}</h2>`;
}

// ─── Divider ──────────────────────────────────────────────────
function divider() {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
    style="margin:24px 0;">
    <tr><td style="border-top:1px solid ${BRAND.border};"></td></tr>
  </table>`;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1 — KYC SUBMITTED
// ═══════════════════════════════════════════════════════════════
function buildKycSubmittedHtml({ name, userId, submittedAt }) {
  const appId = formatAppId(userId);
  const dateStr = formatDate(submittedAt);
  const fullName = name || 'Applicant';

  const body = `
    <!-- Status icon -->
    <div style="text-align:center;margin-bottom:24px;">
      ${statusIcon('📋', BRAND.pendingBg)}
    </div>

    <!-- Title + badge -->
    <div style="text-align:center;margin-bottom:28px;">
      ${sectionHeading('KYC Application Submitted', BRAND.blue)}
      <p style="margin:6px 0 14px;font-size:14px;color:${BRAND.textMuted};">
        Your application is now under review
      </p>
      ${statusBadge('UNDER REVIEW', BRAND.pendingBg, BRAND.pending, BRAND.pendingBdr)}
    </div>

    ${divider()}

    <!-- Greeting -->
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.text};font-weight:600;">
      Hello ${fullName},
    </p>
    <p style="margin:0 0 10px;font-size:14px;color:${BRAND.textMuted};line-height:1.7;">
      Thank you for submitting your KYC application on the <strong>Vexaro KYC Portal</strong>.
      Your documents have been received and are currently queued for verification.
    </p>
    <p style="margin:0;font-size:14px;color:${BRAND.textMuted};line-height:1.7;">
      Our team will review your application and notify you once a decision has been made.
      This typically takes <strong>1–3 business days</strong>.
    </p>

    <!-- Info card -->
    ${infoCard([
      ['Application ID', `<strong style="color:${BRAND.orange};font-family:monospace;font-size:15px;">${appId}</strong>`],
      ['Applicant Name', fullName],
      ['Status', `<span style="color:${BRAND.pending};font-weight:700;">Under Review</span>`],
      ['Submitted On', dateStr],
    ])}

    <!-- CTA -->
    ${ctaButton('View Application')}

    ${divider()}

    <!-- Info note -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background:${BRAND.infoBg};border:1px solid ${BRAND.infoBdr};
                  border-radius:8px;margin-top:8px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;font-size:13px;color:${BRAND.infoText};line-height:1.6;">
            <strong>&#9432;&nbsp; What happens next?</strong><br>
            You will receive an email notification once your KYC is approved or if any
            corrections are needed. You may also log in to the portal to check your
            application status at any time.
          </p>
        </td>
      </tr>
    </table>`;

  return baseLayout({
    preheader: `Your KYC application (${appId}) has been submitted and is under review.`,
    headerSubtitle: 'KYC Portal',
    body,
  });
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2 — KYC APPROVED
// ═══════════════════════════════════════════════════════════════
function buildKycApprovedHtml({ name, userId, submittedAt, reviewedAt }) {
  const appId = formatAppId(userId);
  const submittedStr = formatDate(submittedAt);
  const reviewedStr = formatDate(reviewedAt);
  const fullName = name || 'Applicant';

  const body = `
    <!-- Status icon -->
    <div style="text-align:center;margin-bottom:24px;">
      ${statusIcon('✅', BRAND.successBg)}
    </div>

    <!-- Title + badge -->
    <div style="text-align:center;margin-bottom:28px;">
      ${sectionHeading('KYC Verification Approved', BRAND.success)}
      <p style="margin:6px 0 14px;font-size:14px;color:${BRAND.textMuted};">
        Congratulations! Your identity has been verified.
      </p>
      ${statusBadge('APPROVED', BRAND.successBg, BRAND.success, BRAND.successBdr)}
    </div>

    ${divider()}

    <!-- Greeting -->
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.text};font-weight:600;">
      Hello ${fullName},
    </p>
    <p style="margin:0 0 10px;font-size:14px;color:${BRAND.textMuted};line-height:1.7;">
      Great news! Your KYC application has been <strong>successfully reviewed and approved</strong>
      by the Vexaro verification team. Your account is now fully verified and active.
    </p>
    <p style="margin:0;font-size:14px;color:${BRAND.textMuted};line-height:1.7;">
      You can now access all features of the Vexaro Courier platform. Welcome aboard!
    </p>

    <!-- Info card -->
    ${infoCard([
      ['Application ID', `<strong style="color:${BRAND.orange};font-family:monospace;font-size:15px;">${appId}</strong>`],
      ['Applicant Name', fullName],
      ['Status', `<span style="color:${BRAND.success};font-weight:700;">&#10003; Approved</span>`],
      ['Submitted On', submittedStr],
      ['Approved On', `<strong>${reviewedStr}</strong>`],
    ])}

    <!-- CTA -->
    ${ctaButton('Access Your Account')}

    ${divider()}

    <!-- Success note -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background:${BRAND.successBg};border:1px solid ${BRAND.successBdr};
                  border-radius:8px;margin-top:8px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;font-size:13px;color:${BRAND.success};line-height:1.6;">
            <strong>&#10003;&nbsp; Your account is now fully active</strong><br>
            All Vexaro Courier services are now available to you. Log in to the portal
            to manage your account and start using our services.
          </p>
        </td>
      </tr>
    </table>`;

  return baseLayout({
    preheader: `Your KYC application (${appId}) has been approved. Your account is now active!`,
    headerSubtitle: 'KYC Portal',
    body,
  });
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3 — KYC REJECTED
// ═══════════════════════════════════════════════════════════════
function buildKycRejectedHtml({ name, userId, submittedAt, reviewedAt, rejectionReason }) {
  const appId = formatAppId(userId);
  const submittedStr = formatDate(submittedAt);
  const reviewedStr = formatDate(reviewedAt);
  const fullName = name || 'Applicant';
  const reason = rejectionReason || 'Please contact Vexaro Support for details.';

  const body = `
    <!-- Status icon -->
    <div style="text-align:center;margin-bottom:24px;">
      ${statusIcon('⚠️', BRAND.dangerBg)}
    </div>

    <!-- Title + badge -->
    <div style="text-align:center;margin-bottom:28px;">
      ${sectionHeading('KYC Verification Update', BRAND.danger)}
      <p style="margin:6px 0 14px;font-size:14px;color:${BRAND.textMuted};">
        Action required — your application needs attention
      </p>
      ${statusBadge('REJECTED', BRAND.dangerBg, BRAND.danger, BRAND.dangerBdr)}
    </div>

    ${divider()}

    <!-- Greeting -->
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.text};font-weight:600;">
      Hello ${fullName},
    </p>
    <p style="margin:0 0 10px;font-size:14px;color:${BRAND.textMuted};line-height:1.7;">
      After reviewing your KYC application, our verification team was unable to approve
      it at this time. Please see the details below for the reason.
    </p>

    <!-- Info card -->
    ${infoCard([
      ['Application ID', `<strong style="color:${BRAND.orange};font-family:monospace;font-size:15px;">${appId}</strong>`],
      ['Applicant Name', fullName],
      ['Status', `<span style="color:${BRAND.danger};font-weight:700;">&#x2715; Rejected</span>`],
      ['Submitted On', submittedStr],
      ['Reviewed On', reviewedStr],
    ])}

    <!-- Rejection Reason section -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background:${BRAND.dangerBg};border:1.5px solid ${BRAND.dangerBdr};
                  border-radius:10px;margin:24px 0 0;overflow:hidden;">
      <tr>
        <td style="background:${BRAND.danger};padding:10px 18px;">
          <span style="font-size:11px;color:#ffffff;font-weight:700;
                       letter-spacing:1px;text-transform:uppercase;">
            ⚠&nbsp; Reason for Rejection
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0;font-size:14px;color:${BRAND.text};line-height:1.7;font-style:italic;">
            "${reason}"
          </p>
        </td>
      </tr>
    </table>

    <!-- What to do next -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background:#fff8f0;border:1.5px solid #fed7aa;
                  border-radius:10px;margin:16px 0 0;overflow:hidden;">
      <tr>
        <td style="background:${BRAND.orange};padding:10px 18px;">
          <span style="font-size:11px;color:#ffffff;font-weight:700;
                       letter-spacing:1px;text-transform:uppercase;">
            &#8594;&nbsp; What To Do Next
          </span>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 8px;font-size:14px;color:${BRAND.text};line-height:1.7;">
            Please review the reason above and take the following steps:
          </p>
          <ol style="margin:0;padding-left:20px;font-size:14px;color:${BRAND.textMuted};line-height:1.9;">
            <li>Log in to the Vexaro Portal</li>
            <li>Review the rejection reason carefully</li>
            <li>Prepare the correct documents or information</li>
            <li>Re-submit your KYC application</li>
          </ol>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    ${ctaButton('Re-submit KYC Application')}

    ${divider()}

    <!-- Help note -->
    <p style="margin:0;font-size:13px;color:${BRAND.textMuted};line-height:1.6;text-align:center;">
      If you believe this decision is incorrect or need assistance,<br>
      please contact us at
      <a href="mailto:${SUPPORT_EMAIL}"
         style="color:${BRAND.orange};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
    </p>`;

  return baseLayout({
    preheader: `Important update on your KYC application (${appId}). Action required.`,
    headerSubtitle: 'KYC Portal',
    body,
  });
}

// ─── Send helpers ─────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[email] skipped — EMAIL_HOST/EMAIL_USER/EMAIL_PASS not configured');
    return { sent: false, skipped: true, reason: 'email_not_configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      html,
      headers: {
        'X-Mailer': 'Vexaro KYC Portal',
        'X-Priority': '3',
      },
    });
    console.info('[email] sent', { to, subject, messageId: info.messageId });
    return { sent: true, skipped: false, messageId: info.messageId };
  } catch (err) {
    console.error('[email] failed', { to, subject, error: err.message });
    return { sent: false, skipped: false, error: err.message };
  }
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Send KYC Submitted email.
 * @param {{ email:string, name:string, userId:number|string, submittedAt:Date }} user
 */
async function sendKycSubmittedEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };
  const html = buildKycSubmittedHtml({
    name: user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
    userId: user.id || user.userId,
    submittedAt: user.submittedAt || new Date(),
  });
  return sendEmail({
    to: user.email,
    subject: `KYC Application Submitted — ${formatAppId(user.id || user.userId)}`,
    html,
  });
}

/**
 * Send KYC Approved email.
 * @param {{ email:string, name:string, userId:number|string, submittedAt:Date, reviewedAt:Date }} user
 */
async function sendKycApprovedEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };
  const html = buildKycApprovedHtml({
    name: user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
    userId: user.id || user.userId,
    submittedAt: user.submittedAt,
    reviewedAt: user.reviewedAt || new Date(),
  });
  return sendEmail({
    to: user.email,
    subject: `✅ KYC Approved — ${formatAppId(user.id || user.userId)} — Vexaro`,
    html,
  });
}

/**
 * Send KYC Rejected email.
 * @param {{ email:string, name:string, userId:number|string, submittedAt:Date, reviewedAt:Date, rejectionReason:string }} user
 */
async function sendKycRejectedEmail(user) {
  if (!user?.email) return { sent: false, skipped: true, reason: 'missing_email' };
  const html = buildKycRejectedHtml({
    name: user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
    userId: user.id || user.userId,
    submittedAt: user.submittedAt,
    reviewedAt: user.reviewedAt || new Date(),
    rejectionReason: user.rejectionReason,
  });
  return sendEmail({
    to: user.email,
    subject: `⚠️ KYC Application Update — ${formatAppId(user.id || user.userId)} — Vexaro`,
    html,
  });
}

// Export HTML builders for preview/testing
module.exports = {
  sendKycSubmittedEmail,
  sendKycApprovedEmail,
  sendKycRejectedEmail,
  // Exposed for preview endpoint / unit tests
  buildKycSubmittedHtml,
  buildKycApprovedHtml,
  buildKycRejectedHtml,
};
