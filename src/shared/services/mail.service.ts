import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

// ── Transport setup ────────────────────────────────────────────────────────────

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function createSmtpTransporter(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

const smtpTransporter = createSmtpTransporter();

async function send(opts: MailOptions): Promise<void> {
  const from = `${env.FROM_NAME} <${env.FROM_EMAIL}>`;

  // 1. Resend (preferred)
  if (resend) {
    const { error } = await resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html });
    if (error) {
      logger.error('Resend failed', { to: opts.to, error });
      throw new Error(error.message);
    }
    return;
  }

  // 2. SMTP fallback
  if (smtpTransporter) {
    await smtpTransporter.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
    return;
  }

  // 3. No transport — log only
  logger.info('[MAIL STUB] no transport configured', { to: opts.to, subject: opts.subject });
}

// ── Branded HTML wrapper ───────────────────────────────────────────────────────

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  body{margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  .wrap{max-width:580px;margin:24px auto;background:#fff;border-radius:4px;overflow:hidden;border:1px solid #ddd}
  .head{background:#DB0011;padding:20px 32px;display:flex;align-items:center;gap:12px}
  .head-logo{width:32px;height:32px;background:#fff;border-radius:4px;display:flex;align-items:center;justify-content:center}
  .head h1{margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.2px}
  .body{padding:28px 32px}
  .body p{margin:0 0 14px;color:#333;font-size:15px;line-height:1.55}
  .otp{display:block;text-align:center;font-size:38px;font-weight:800;letter-spacing:12px;color:#DB0011;margin:24px 0;font-family:monospace}
  .note{font-size:13px;color:#888;text-align:center}
  .divider{border:none;border-top:1px solid #eee;margin:20px 0}
  .foot{background:#f9f9f9;border-top:1px solid #e8e8e8;padding:20px 32px}
  .foot p{margin:0 0 6px;font-size:11px;color:#999;line-height:1.5}
  .foot .reg{font-size:10px;color:#bbb;margin-top:10px}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>&#9670; Lumina Bank</h1>
  </div>
  <div class="body">${body}</div>
  <div class="foot">
    <p>This is an automated notification. Please do not reply to this email.</p>
    <p>For help, email <a href="mailto:support@luminabank.online" style="color:#DB0011">support@luminabank.online</a> or call <strong>0800 123 4567</strong> (free, 24/7).</p>
    <p class="reg">Lumina Bank plc is authorised by the Prudential Regulation Authority and regulated by the Financial Conduct Authority and the Prudential Regulation Authority (FCA Register No. 123456). Registered in England &amp; Wales No. 12345678. Registered office: 1 Lumina Square, London, EC2V 8RF.</p>
    <p class="reg">© ${new Date().getFullYear()} Lumina Bank plc. All rights reserved. FSCS protected up to £85,000.</p>
  </div>
</div>
</body>
</html>`;
}

// ── Transaction email layout (UK bank style) ───────────────────────────────────

function txLayout(opts: {
  title: string;
  preheader: string;
  amountLine: string;        // e.g. "+£20,000.00"
  amountColor: string;       // e.g. "#1a7a3f" (credit green) or "#DB0011" (debit red)
  directionLabel: string;    // e.g. "MONEY IN" / "MONEY OUT"
  rows: { label: string; value: string; mono?: boolean }[];
  balanceAfter?: string;
  accountMasked?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  warningNote?: string;
  recipientName?: string;
}): string {
  const rowsHtml = opts.rows.map(r => `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px;width:42%">${r.label}</td>
      <td style="padding:11px 0;border-bottom:1px solid #f0f0f0;color:#111;font-size:13px;font-weight:600;text-align:right${r.mono ? ';font-family:monospace;letter-spacing:0.5px' : ''}">${r.value}</td>
    </tr>`).join('');

  const ctaHtml = opts.ctaLabel && opts.ctaUrl ? `
    <div style="text-align:center;margin:28px 0 8px">
      <a href="${opts.ctaUrl}" style="background:#DB0011;color:#fff;text-decoration:none;padding:13px 32px;border-radius:4px;font-size:14px;font-weight:700;display:inline-block;letter-spacing:0.2px">${opts.ctaLabel}</a>
    </div>` : '';

  const balanceHtml = opts.balanceAfter ? `
    <div style="background:#f8f8f8;border:1px solid #ebebeb;border-radius:4px;padding:14px 18px;margin:20px 0;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:#666">Available balance</span>
      <span style="font-size:18px;font-weight:800;color:#111">${opts.balanceAfter}</span>
    </div>` : '';

  const warningHtml = opts.warningNote ? `
    <div style="background:#fff8f0;border-left:3px solid #e67e00;padding:12px 16px;margin:20px 0;border-radius:2px">
      <p style="margin:0;font-size:12.5px;color:#7a4500;line-height:1.5">${opts.warningNote}</p>
    </div>` : '';

  const greeting = opts.recipientName ? `<p style="margin:0 0 20px;font-size:15px;color:#333">Dear <strong>${opts.recipientName}</strong>,</p>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<!-- preheader -->
<div style="display:none;max-height:0;overflow:hidden;color:#f0f0f0;font-size:1px">${opts.preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:20px 0">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#fff;border:1px solid #d8d8d8">

  <!-- Header -->
  <tr>
    <td style="background:#DB0011;padding:18px 28px">
      <span style="color:#fff;font-size:19px;font-weight:800;letter-spacing:-0.3px">&#9670; Lumina Bank</span>
    </td>
  </tr>

  <!-- Amount hero -->
  <tr>
    <td style="background:#8B000A;padding:28px 28px 24px;text-align:center">
      <div style="display:inline-block;background:rgba(255,255,255,0.06);border-radius:4px;padding:6px 14px;margin-bottom:10px">
        <span style="font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.5);text-transform:uppercase">${opts.directionLabel}</span>
      </div>
      <div style="font-size:42px;font-weight:800;color:${opts.amountColor};letter-spacing:-1px;line-height:1">${opts.amountLine}</div>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:28px 28px 8px">
      ${greeting}
      <table width="100%" cellpadding="0" cellspacing="0">
        ${rowsHtml}
      </table>
      ${balanceHtml}
      ${ctaHtml}
      ${warningHtml}
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f7f7f7;border-top:1px solid #e8e8e8;padding:20px 28px">
      <p style="margin:0 0 5px;font-size:11.5px;color:#888;line-height:1.55">This is an automated notification sent to you because you have transaction alerts enabled. Do not reply to this email.</p>
      <p style="margin:0 0 5px;font-size:11.5px;color:#888">Help: <a href="mailto:support@luminabank.online" style="color:#DB0011;text-decoration:none">support@luminabank.online</a> · <strong>0800 123 4567</strong></p>
      <p style="margin:12px 0 0;font-size:10px;color:#bbb;line-height:1.55">Lumina Bank plc is authorised by the Prudential Regulation Authority and regulated by the Financial Conduct Authority and the Prudential Regulation Authority (FRN 123456). Registered in England &amp; Wales No. 12345678. Registered office: 1 Lumina Square, London EC2V 8RF. FSCS protected up to £85,000.</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function formatUKDate(d = new Date()): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatUKTime(d = new Date()): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function maskAccount(accountNumber: string): string {
  return `****${accountNumber.slice(-4)}`;
}

// ── Public mail helpers ────────────────────────────────────────────────────────

export const mailService = {
  async sendVerificationOtp(to: string, code: string): Promise<void> {
    const body = `
      <p>Welcome to <strong>Lumina Bank</strong>! Please verify your email address using the code below.</p>
      <span class="otp">${code}</span>
      <p class="note">This code expires in <strong>10 minutes</strong>. If you did not create an account, you can safely ignore this email.</p>`;
    await send({ to, subject: 'Verify your Lumina Bank email', html: layout('Email Verification', body) });
  },

  async sendPasswordResetOtp(to: string, code: string): Promise<void> {
    const body = `
      <p>We received a request to reset your Lumina Bank password. Use the code below to proceed.</p>
      <span class="otp">${code}</span>
      <p class="note">This code expires in <strong>10 minutes</strong>. If you did not request a password reset, please contact support immediately.</p>`;
    await send({ to, subject: 'Reset your Lumina Bank password', html: layout('Password Reset', body) });
  },

  async sendTransferOtp(to: string, code: string): Promise<void> {
    const body = `
      <p style="margin:0 0 8px;font-size:15px;color:#333">You're about to authorise a payment from your Lumina Bank account.</p>
      <p style="margin:0 0 20px;font-size:13px;color:#666">Enter this code in the app to confirm. <strong>Never share this code with anyone.</strong> Lumina Bank staff will never ask for it.</p>
      <span class="otp">${code}</span>
      <p class="note">This code expires in <strong>10 minutes</strong>. If you did not request this, call us immediately on <strong>0800 123 4567</strong>.</p>`;
    await send({ to, subject: `Your Lumina Bank payment authorisation code: ${code}`, html: layout('Payment Authorisation', body) });
  },

  async sendLoginOtp(to: string, code: string): Promise<void> {
    const body = `
      <p>A sign-in was attempted on your Lumina Bank account. Enter this code to complete login.</p>
      <span class="otp">${code}</span>
      <p class="note">This code expires in <strong>10 minutes</strong>. If this wasn't you, reset your password immediately.</p>`;
    await send({ to, subject: 'Your Lumina Bank login code', html: layout('Sign-in Verification', body) });
  },

  async sendTransferNotification(to: string, opts: {
    amount: string; currency: string; recipient: string; reference: string;
    recipientName?: string; accountNumber?: string; balanceAfter?: string; description?: string;
  }): Promise<void> {
    const now = new Date();
    const symbol = opts.currency === 'GBP' ? '£' : opts.currency === 'EUR' ? '€' : opts.currency === 'USD' ? '$' : opts.currency + ' ';
    const rows: { label: string; value: string; mono?: boolean }[] = [
      { label: 'Amount', value: `${symbol}${opts.amount}` },
      { label: 'Paid to', value: opts.recipient },
      ...(opts.description ? [{ label: 'Payment reference', value: opts.description }] : []),
      ...(opts.accountNumber ? [{ label: 'From account', value: maskAccount(opts.accountNumber) }] : []),
      { label: 'Date', value: formatUKDate(now) },
      { label: 'Time', value: `${formatUKTime(now)} GMT` },
      { label: 'Transaction ID', value: opts.reference, mono: true },
    ];
    const html = txLayout({
      title: 'Payment sent | Lumina Bank',
      preheader: `You sent ${symbol}${opts.amount} to ${opts.recipient}`,
      amountLine: `−${symbol}${opts.amount}`,
      amountColor: '#DB0011',
      directionLabel: 'MONEY OUT',
      rows,
      balanceAfter: opts.balanceAfter ? `${symbol}${opts.balanceAfter}` : undefined,
      accountMasked: opts.accountNumber ? maskAccount(opts.accountNumber) : undefined,
      recipientName: opts.recipientName,
      ctaLabel: 'View transaction',
      ctaUrl: 'https://luminabank.online/transactions',
      warningNote: 'Did not make this payment? Call us immediately on <strong>0800 123 4567</strong> (free, 24/7) and we will secure your account.',
    });
    await send({ to, subject: `Payment of ${symbol}${opts.amount} sent to ${opts.recipient} | Lumina Bank`, html });
  },

  async sendMoneyReceived(to: string, opts: {
    amount: string; currency: string; sender: string; description: string;
    recipientName?: string; accountNumber?: string; balanceAfter?: string;
  }): Promise<void> {
    const now = new Date();
    const symbol = opts.currency === 'GBP' ? '£' : opts.currency === 'EUR' ? '€' : opts.currency === 'USD' ? '$' : opts.currency + ' ';
    const rows: { label: string; value: string; mono?: boolean }[] = [
      { label: 'Amount', value: `${symbol}${opts.amount}` },
      { label: 'Received from', value: opts.sender },
      { label: 'Payment reference', value: opts.description },
      ...(opts.accountNumber ? [{ label: 'Into account', value: maskAccount(opts.accountNumber) }] : []),
      { label: 'Date', value: formatUKDate(now) },
      { label: 'Time', value: `${formatUKTime(now)} GMT` },
    ];
    const html = txLayout({
      title: 'Money received | Lumina Bank',
      preheader: `${symbol}${opts.amount} from ${opts.sender} has arrived in your account`,
      amountLine: `+${symbol}${opts.amount}`,
      amountColor: '#1a9c52',
      directionLabel: 'MONEY IN',
      rows,
      balanceAfter: opts.balanceAfter ? `${symbol}${opts.balanceAfter}` : undefined,
      accountMasked: opts.accountNumber ? maskAccount(opts.accountNumber) : undefined,
      recipientName: opts.recipientName,
      ctaLabel: 'View account',
      ctaUrl: 'https://luminabank.online/dashboard',
      warningNote: 'Not expecting this payment? You may need to return it. <a href="https://luminabank.online/support" style="color:#7a4500">Contact us</a> for guidance.',
    });
    await send({ to, subject: `${symbol}${opts.amount} received from ${opts.sender} | Lumina Bank`, html });
  },

  async sendKycStatusUpdate(to: string, status: 'VERIFIED' | 'REJECTED', reason?: string): Promise<void> {
    const approved = status === 'VERIFIED';
    const body = approved
      ? `<p>Great news! Your identity verification has been <strong>approved</strong>. Your account is now fully verified.</p>`
      : `<p>Unfortunately your identity verification was <strong>not approved</strong>.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}<p>Please log in and resubmit your documents.</p>`;
    await send({ to, subject: `KYC ${approved ? 'Approved' : 'Rejected'} | Lumina Bank`, html: layout('Identity Verification Update', body) });
  },

  async sendAccountLockout(to: string, lockDurationMinutes: number): Promise<void> {
    const body = `
      <p>Your Lumina Bank account has been <strong>temporarily locked</strong> due to too many failed sign-in attempts.</p>
      <p>Your account will unlock automatically in <strong>${lockDurationMinutes} minutes</strong>.</p>
      <p>If this wasn't you, your password may be compromised. Once your account unlocks, please <strong>change your password immediately</strong>.</p>
      <p class="note">If you need urgent assistance, contact our support team.</p>`;
    await send({ to, subject: 'Security alert: account temporarily locked | Lumina Bank', html: layout('Account Locked', body) });
  },

  async sendPasswordChanged(to: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank password was successfully changed.</p>
      <p>If you made this change, no action is needed.</p>
      <p><strong>If you did not request this change</strong>, your account may be compromised. Please contact our support team immediately and we will secure your account.</p>
      <p class="note">For your security, all active sessions have been signed out.</p>`;
    await send({ to, subject: 'Your password has been changed | Lumina Bank', html: layout('Password Changed', body) });
  },

  async sendLoanDecision(to: string, opts: { approved: boolean; loanType: string; amount?: number; reason?: string }): Promise<void> {
    const { approved, loanType, amount, reason } = opts;
    const type = loanType.charAt(0).toUpperCase() + loanType.slice(1).toLowerCase();
    const body = approved
      ? `<p>Great news! Your <strong>${type} loan application</strong> has been approved.</p>
         <p><strong>Amount:</strong> £${amount?.toLocaleString() ?? '—'}<br/>The funds have been credited to your account and are available immediately.</p>
         <p class="note">Log in to your Lumina Bank app to view your repayment schedule.</p>`
      : `<p>We regret to inform you that your <strong>${type} loan application</strong> has not been approved at this time.</p>
         ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
         <p>You are welcome to reapply in the future or contact our support team to discuss your options.</p>`;
    await send({
      to,
      subject: `Loan application ${approved ? 'approved' : 'update'} | Lumina Bank`,
      html: layout(`Loan Application ${approved ? 'Approved' : 'Update'}`, body),
    });
  },

  async sendAccountSuspended(to: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank account has been <strong>temporarily suspended</strong>.</p>
      <p>During this period you will not be able to log in or access your funds.</p>
      <p>Please contact our support team for more information or to appeal this decision.</p>`;
    await send({ to, subject: 'Your account has been suspended | Lumina Bank', html: layout('Account Suspended', body) });
  },

  async sendAccountReactivated(to: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank account has been <strong>reactivated</strong> and you can now log in as normal.</p>
      <p>If you have any questions, please don't hesitate to contact our support team.</p>`;
    await send({ to, subject: 'Your account has been reactivated | Lumina Bank', html: layout('Account Reactivated', body) });
  },

  async sendTransferRejected(to: string, opts: { amount: string; currency: string; reason?: string }): Promise<void> {
    const { amount, currency, reason } = opts;
    const body = `
      <p>Your transfer of <strong>${currency} ${amount}</strong> has been <strong>rejected</strong> by our compliance team.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>The full amount has been <strong>refunded to your account</strong> and is available immediately.</p>
      <p class="note">If you believe this was in error, please contact support.</p>`;
    await send({ to, subject: 'Transfer rejected | Lumina Bank', html: layout('Transfer Rejected', body) });
  },

  async sendDisputeOutcome(to: string, opts: { resolved: boolean; subject: string; resolution: string }): Promise<void> {
    const { resolved, subject: disputeSubject, resolution } = opts;
    const body = resolved
      ? `<p>Your dispute <strong>"${disputeSubject}"</strong> has been <strong>resolved</strong>.</p>
         <p><strong>Resolution:</strong> ${resolution}</p>
         <p class="note">If you have further questions, please contact support.</p>`
      : `<p>After careful review, your dispute <strong>"${disputeSubject}"</strong> could not be upheld.</p>
         <p><strong>Reason:</strong> ${resolution}</p>
         <p class="note">If you believe this is incorrect, please contact support to discuss further options.</p>`;
    await send({
      to,
      subject: `Dispute ${resolved ? 'resolved' : 'update'} | Lumina Bank`,
      html: layout(`Dispute ${resolved ? 'Resolved' : 'Update'}`, body),
    });
  },

  async sendInsuranceDecision(to: string, opts: { accepted: boolean; insuranceType: string; premium?: number; notes?: string }): Promise<void> {
    const { accepted, insuranceType, premium, notes } = opts;
    const type = insuranceType.charAt(0).toUpperCase() + insuranceType.slice(1).toLowerCase();
    const body = accepted
      ? `<p>Your <strong>${type} insurance</strong> quote has been <strong>accepted</strong>.</p>
         ${premium ? `<p><strong>Monthly premium:</strong> £${premium.toFixed(2)}</p>` : ''}
         <p>Your policy is now active. Log in to the Lumina Bank app to view your policy details.</p>`
      : `<p>Unfortunately your <strong>${type} insurance</strong> quote could not be processed at this time.</p>
         ${notes ? `<p><strong>Reason:</strong> ${notes}</p>` : ''}
         <p>Please contact our insurance team to discuss your options.</p>`;
    await send({
      to,
      subject: `Insurance quote ${accepted ? 'accepted' : 'update'} | Lumina Bank`,
      html: layout(`Insurance Quote ${accepted ? 'Accepted' : 'Update'}`, body),
    });
  },

  async send2FAChanged(to: string, enabled: boolean): Promise<void> {
    const body = enabled
      ? `<p>Two-factor authentication has been <strong>enabled</strong> on your Lumina Bank account.</p>
         <p>Your account is now more secure. You will need your authenticator app each time you sign in.</p>
         <p class="note">If you did not make this change, contact support immediately.</p>`
      : `<p>Two-factor authentication has been <strong>disabled</strong> on your Lumina Bank account.</p>
         <p>Your account is now protected by password only. We strongly recommend re-enabling 2FA.</p>
         <p class="note">If you did not make this change, your account may be compromised — contact support immediately.</p>`;
    await send({
      to,
      subject: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} | Lumina Bank`,
      html: layout(`2FA ${enabled ? 'Enabled' : 'Disabled'}`, body),
    });
  },

  async sendCardBlocked(to: string, last4: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank card ending in <strong>${last4}</strong> has been <strong>blocked</strong> by our team.</p>
      <p>The card cannot be used for any transactions until it is unblocked.</p>
      <p class="note">If this was unexpected, please contact support immediately.</p>`;
    await send({ to, subject: `Card ending ${last4} blocked | Lumina Bank`, html: layout('Card Blocked', body) });
  },

  async sendSecurityAlert(to: string, opts: { event: string; detail?: string }): Promise<void> {
    const body = `
      <p>A security event was detected on your Lumina Bank account: <strong>${opts.event}</strong>.</p>
      ${opts.detail ? `<p>${opts.detail}</p>` : ''}
      <p>All active sessions have been signed out as a precaution.</p>
      <p class="note">If this was you, simply log back in. If you did not take this action, please <strong>change your password immediately</strong> and contact support.</p>`;
    await send({ to, subject: `Security alert | Lumina Bank`, html: layout('Security Alert', body) });
  },

  async sendCryptoOrderDecision(to: string, opts: { approved: boolean; coin: string; amountGbp: number; reference: string; reason?: string }): Promise<void> {
    const { approved, coin, amountGbp, reference, reason } = opts;
    const body = approved
      ? `<p>Your crypto purchase order has been <strong>approved</strong> and is being processed.</p>
         <p><strong>Asset:</strong> ${coin}<br/>
         <strong>Amount:</strong> £${amountGbp.toFixed(2)}<br/>
         <strong>Reference:</strong> ${reference}</p>
         <p class="note">Your crypto will be sent to the wallet address you provided within 1–2 business days.</p>`
      : `<p>Unfortunately your crypto purchase order could not be processed.</p>
         <p><strong>Asset:</strong> ${coin}<br/>
         <strong>Amount:</strong> £${amountGbp.toFixed(2)}<br/>
         <strong>Reference:</strong> ${reference}</p>
         ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
         <p>The full amount including the processing fee has been <strong>refunded to your account</strong>.</p>`;
    await send({
      to,
      subject: `Crypto order ${approved ? 'approved' : 'rejected'} | Lumina Bank`,
      html: layout(`Crypto Order ${approved ? 'Approved' : 'Rejected'}`, body),
    });
  },

  async sendTicketSubmitted(to: string, opts: { firstName: string; subject: string }): Promise<void> {
    const { firstName, subject } = opts;
    const body = `
      <p>Hi ${firstName},</p>
      <p>We have received your support request and a member of our team will be in touch shortly.</p>
      <div style="background:#F8F8F8;border:1px solid #E8E8E8;border-radius:4px;padding:14px 18px;margin:20px 0;">
        <p style="margin:0 0 4px;font-size:11px;color:#AAAAAA;text-transform:uppercase;letter-spacing:1px">Your ticket</p>
        <p style="margin:0;font-size:15px;font-weight:700;color:#333;">${subject}</p>
      </div>
      <p>You can view your conversation and send additional messages by logging in to the Lumina Bank app.</p>
      <p class="note">If you did not raise this ticket, please contact us at <a href="mailto:support@luminabank.online">support@luminabank.online</a>.</p>`;
    await send({
      to,
      subject: `We received your request: ${subject} | Lumina Bank`,
      html: layout('Support Request Received', body),
    });
  },

  async sendSupportReply(to: string, opts: { firstName: string; subject: string; replyBody: string; agentName?: string; agentAvatarUrl?: string | null }): Promise<void> {
    const { firstName, subject, replyBody, agentName } = opts;
    const agentLine = agentName
      ? `<p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#DB0011;">${agentName} &middot; Lumina Bank Support</p>`
      : '';
    const body = `
      <p>Hi ${firstName},</p>
      <p>Our support team has replied to your ticket: <strong>${subject}</strong></p>
      <div style="background:#F8F8F8;border-left:4px solid #DB0011;padding:14px 18px;margin:20px 0;border-radius:4px;">
        ${agentLine}
        <p style="margin:0;color:#333;line-height:1.6;">${replyBody.replace(/\n/g, '<br/>')}</p>
      </div>
      <p>Log in to your account to continue the conversation or mark the ticket as resolved.</p>
      <p class="note">If you did not raise this ticket, please contact us immediately at <a href="mailto:support@luminabank.online">support@luminabank.online</a>.</p>`;
    await send({
      to,
      subject: `New reply: ${subject} | Lumina Bank`,
      html: layout('Support Team Reply', body),
    });
  },

  async sendTicketResolved(to: string, opts: { firstName: string; subject: string }): Promise<void> {
    const { firstName, subject } = opts;
    const body = `
      <p>Hi ${firstName},</p>
      <p>Your support ticket has been <strong>resolved</strong> by our team.</p>
      <div style="background:#F8F8F8;border:1px solid #E8E8E8;border-radius:4px;padding:14px 18px;margin:20px 0;">
        <p style="margin:0 0 4px;font-size:11px;color:#AAAAAA;text-transform:uppercase;letter-spacing:1px">Resolved ticket</p>
        <p style="margin:0;font-size:15px;font-weight:700;color:#333;">${subject}</p>
      </div>
      <p>If you are satisfied with the resolution, no further action is needed. If the issue persists, you can open a new conversation from the Lumina Bank app.</p>
      <p class="note">Thank you for banking with Lumina Bank.</p>`;
    await send({
      to,
      subject: `Ticket resolved: ${subject} | Lumina Bank`,
      html: layout('Ticket Resolved', body),
    });
  },

  async sendCardUnblocked(to: string, last4: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank card ending in <strong>${last4}</strong> has been <strong>unblocked</strong> and is ready to use.</p>
      <p>You can now make purchases and withdrawals as normal.</p>
      <p class="note">If you did not request this or this was unexpected, please contact support immediately.</p>`;
    await send({ to, subject: `Card ending ${last4} unblocked | Lumina Bank`, html: layout('Card Unblocked', body) });
  },

  async sendAccountFrozen(to: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank account has been <strong>temporarily frozen</strong>.</p>
      <p>While frozen, you will not be able to make payments or transfers from this account. Your funds remain safe.</p>
      <p>Please contact our support team if you have any questions or to request a review of this decision.</p>`;
    await send({ to, subject: 'Your account has been frozen | Lumina Bank', html: layout('Account Frozen', body) });
  },

  async sendAccountUnfrozen(to: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank account has been <strong>unfrozen</strong> and is now fully accessible.</p>
      <p>You can make payments and transfers as normal.</p>
      <p class="note">If you did not request this or this was unexpected, please contact support immediately.</p>`;
    await send({ to, subject: 'Your account has been unfrozen | Lumina Bank', html: layout('Account Unfrozen', body) });
  },

  async sendTransferApproved(to: string, opts: { amount: string; currency: string }): Promise<void> {
    const { amount, currency } = opts;
    const body = `
      <p>Your transfer of <strong>${currency} ${amount}</strong> has been <strong>approved</strong> and successfully processed by our team.</p>
      <p>The funds are on their way to the recipient.</p>
      <p class="note">If you have any questions about this transfer, please contact our support team.</p>`;
    await send({ to, subject: `Transfer approved: ${currency} ${amount} | Lumina Bank`, html: layout('Transfer Approved', body) });
  },

  async sendStandingOrderExecuted(to: string, opts: { amount: string; currency: string; recipientName: string; description: string; balanceAfter: string }): Promise<void> {
    const { amount, currency, recipientName, description, balanceAfter } = opts;
    const body = `
      <p>Your standing order has been executed successfully.</p>
      <div style="background:#F8F8F8;border:1px solid #E8E8E8;border-radius:4px;padding:14px 18px;margin:20px 0;">
        <p style="margin:0 0 8px;font-size:11px;color:#AAAAAA;text-transform:uppercase;letter-spacing:1px">Payment details</p>
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#333;">${currency} ${amount}</p>
        <p style="margin:0;font-size:13px;color:#767676;">To: ${recipientName}</p>
        ${description ? `<p style="margin:4px 0 0;font-size:13px;color:#767676;">${description}</p>` : ''}
        <p style="margin:8px 0 0;font-size:12px;color:#AAAAAA;">Balance after: ${currency} ${balanceAfter}</p>
      </div>
      <p class="note">Standing orders run automatically. You can manage them in the Standing Orders section of the app.</p>`;
    await send({ to, subject: `Standing order executed: ${currency} ${amount} to ${recipientName} | Lumina Bank`, html: layout('Standing Order Executed', body) });
  },

  async sendDirectDebitCollected(to: string, opts: { amount: string; currency: string; originatorName: string; balanceAfter: string }): Promise<void> {
    const { amount, currency, originatorName, balanceAfter } = opts;
    const body = `
      <p>A direct debit has been collected from your account.</p>
      <div style="background:#F8F8F8;border:1px solid #E8E8E8;border-radius:4px;padding:14px 18px;margin:20px 0;">
        <p style="margin:0 0 8px;font-size:11px;color:#AAAAAA;text-transform:uppercase;letter-spacing:1px">Collection details</p>
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#333;">${currency} ${amount}</p>
        <p style="margin:0;font-size:13px;color:#767676;">Collected by: ${originatorName}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#AAAAAA;">Balance after: ${currency} ${balanceAfter}</p>
      </div>
      <p class="note">If you did not authorise this direct debit or believe this is an error, raise a dispute in the app immediately.</p>`;
    await send({ to, subject: `Direct debit collected: ${currency} ${amount} by ${originatorName} | Lumina Bank`, html: layout('Direct Debit Collected', body) });
  },

  async sendNewSupportTicketAlert(to: string, opts: { ticketId: string; subject: string; customerName: string; customerEmail: string; firstMessage: string }): Promise<void> {
    const { ticketId, subject, customerName, customerEmail, firstMessage } = opts;
    const body = `
      <p>A new support ticket has been opened and requires attention.</p>
      <div style="background:#F8F8F8;border-left:4px solid #DB0011;padding:14px 18px;margin:20px 0;border-radius:4px;">
        <p style="margin:0 0 4px;font-size:11px;color:#AAAAAA;text-transform:uppercase;letter-spacing:1px">Ticket #${ticketId.slice(0, 8).toUpperCase()}</p>
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#333;">${subject}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#767676;">From: ${customerName} (${customerEmail})</p>
        <hr style="border:none;border-top:1px solid #E8E8E8;margin:12px 0;" />
        <p style="margin:0;font-size:13px;color:#333;line-height:1.6;">${firstMessage.replace(/\n/g, '<br/>')}</p>
      </div>
      <p>Log in to the admin panel to respond.</p>`;
    await send({ to, subject: `New support ticket: "${subject}" from ${customerName} | Lumina Bank`, html: layout('New Support Ticket', body) });
  },

  async sendCustomerRepliedAlert(to: string, opts: { ticketId: string; subject: string; customerName: string; messageBody: string }): Promise<void> {
    const { ticketId, subject, customerName, messageBody } = opts;
    const body = `
      <p><strong>${customerName}</strong> has replied to their support ticket.</p>
      <div style="background:#F8F8F8;border-left:4px solid #DB0011;padding:14px 18px;margin:20px 0;border-radius:4px;">
        <p style="margin:0 0 4px;font-size:11px;color:#AAAAAA;text-transform:uppercase;letter-spacing:1px">Ticket #${ticketId.slice(0, 8).toUpperCase()} — ${subject}</p>
        <hr style="border:none;border-top:1px solid #E8E8E8;margin:12px 0;" />
        <p style="margin:0;font-size:13px;color:#333;line-height:1.6;">${messageBody.replace(/\n/g, '<br/>')}</p>
      </div>
      <p>Log in to the admin panel to continue the conversation.</p>`;
    await send({ to, subject: `Customer replied: "${subject}" | Lumina Bank`, html: layout('Customer Replied', body) });
  },

  async sendTicketClosed(to: string, opts: { firstName: string; subject: string }): Promise<void> {
    const { firstName, subject } = opts;
    const body = `
      <p>Hi ${firstName},</p>
      <p>Your support ticket has been <strong>closed</strong>.</p>
      <div style="background:#F8F8F8;border:1px solid #E8E8E8;border-radius:4px;padding:14px 18px;margin:20px 0;">
        <p style="margin:0 0 4px;font-size:11px;color:#AAAAAA;text-transform:uppercase;letter-spacing:1px">Closed ticket</p>
        <p style="margin:0;font-size:15px;font-weight:700;color:#333;">${subject}</p>
      </div>
      <p>If you need further assistance, you can always open a new conversation from the Help &amp; Support section of the Lumina Bank app.</p>
      <p class="note">Thank you for banking with Lumina Bank.</p>`;
    await send({
      to,
      subject: `Ticket closed: ${subject} | Lumina Bank`,
      html: layout('Ticket Closed', body),
    });
  },
};
