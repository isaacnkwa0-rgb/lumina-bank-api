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
  body{margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .head{background:linear-gradient(135deg,#DB0011,#8B000A);padding:28px 32px;text-align:center}
  .head h1{margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px}
  .head p{margin:4px 0 0;color:rgba(255,255,255,.65);font-size:13px}
  .body{padding:32px}
  .body p{margin:0 0 16px;color:#444;font-size:15px;line-height:1.6}
  .otp{display:block;text-align:center;font-size:38px;font-weight:800;letter-spacing:12px;color:#DB0011;margin:24px 0;font-family:monospace}
  .note{font-size:13px;color:#999;text-align:center}
  .foot{background:#f9f9f9;border-top:1px solid #eee;padding:16px 32px;text-align:center;font-size:12px;color:#bbb}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>Lumina Bank</h1>
    <p>Secure Banking</p>
  </div>
  <div class="body">${body}</div>
  <div class="foot">© ${new Date().getFullYear()} Lumina Bank · This email was sent because an action was taken on your account.</div>
</div>
</body>
</html>`;
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

  async sendLoginOtp(to: string, code: string): Promise<void> {
    const body = `
      <p>A sign-in was attempted on your Lumina Bank account. Enter this code to complete login.</p>
      <span class="otp">${code}</span>
      <p class="note">This code expires in <strong>10 minutes</strong>. If this wasn't you, reset your password immediately.</p>`;
    await send({ to, subject: 'Your Lumina Bank login code', html: layout('Sign-in Verification', body) });
  },

  async sendTransferNotification(to: string, opts: { amount: string; currency: string; recipient: string; reference: string }): Promise<void> {
    const body = `
      <p>A transfer has been processed on your account.</p>
      <p><strong>Amount:</strong> ${opts.currency} ${opts.amount}<br/>
      <strong>To:</strong> ${opts.recipient}<br/>
      <strong>Reference:</strong> ${opts.reference}</p>
      <p class="note">If you did not authorise this transfer, please contact support immediately.</p>`;
    await send({ to, subject: 'Transfer confirmation — Lumina Bank', html: layout('Transfer Confirmation', body) });
  },

  async sendKycStatusUpdate(to: string, status: 'VERIFIED' | 'REJECTED', reason?: string): Promise<void> {
    const approved = status === 'VERIFIED';
    const body = approved
      ? `<p>Great news! Your identity verification has been <strong>approved</strong>. Your account is now fully verified.</p>`
      : `<p>Unfortunately your identity verification was <strong>not approved</strong>.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}<p>Please log in and resubmit your documents.</p>`;
    await send({ to, subject: `KYC ${approved ? 'Approved' : 'Rejected'} — Lumina Bank`, html: layout('Identity Verification Update', body) });
  },

  async sendAccountLockout(to: string, lockDurationMinutes: number): Promise<void> {
    const body = `
      <p>Your Lumina Bank account has been <strong>temporarily locked</strong> due to too many failed sign-in attempts.</p>
      <p>Your account will unlock automatically in <strong>${lockDurationMinutes} minutes</strong>.</p>
      <p>If this wasn't you, your password may be compromised. Once your account unlocks, please <strong>change your password immediately</strong>.</p>
      <p class="note">If you need urgent assistance, contact our support team.</p>`;
    await send({ to, subject: 'Security alert: account temporarily locked — Lumina Bank', html: layout('Account Locked', body) });
  },

  async sendPasswordChanged(to: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank password was successfully changed.</p>
      <p>If you made this change, no action is needed.</p>
      <p><strong>If you did not request this change</strong>, your account may be compromised. Please contact our support team immediately and we will secure your account.</p>
      <p class="note">For your security, all active sessions have been signed out.</p>`;
    await send({ to, subject: 'Your password has been changed — Lumina Bank', html: layout('Password Changed', body) });
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
      subject: `Loan application ${approved ? 'approved' : 'update'} — Lumina Bank`,
      html: layout(`Loan Application ${approved ? 'Approved' : 'Update'}`, body),
    });
  },

  async sendAccountSuspended(to: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank account has been <strong>temporarily suspended</strong>.</p>
      <p>During this period you will not be able to log in or access your funds.</p>
      <p>Please contact our support team for more information or to appeal this decision.</p>`;
    await send({ to, subject: 'Your account has been suspended — Lumina Bank', html: layout('Account Suspended', body) });
  },

  async sendAccountReactivated(to: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank account has been <strong>reactivated</strong> and you can now log in as normal.</p>
      <p>If you have any questions, please don't hesitate to contact our support team.</p>`;
    await send({ to, subject: 'Your account has been reactivated — Lumina Bank', html: layout('Account Reactivated', body) });
  },

  async sendTransferRejected(to: string, opts: { amount: string; currency: string; reason?: string }): Promise<void> {
    const { amount, currency, reason } = opts;
    const body = `
      <p>Your transfer of <strong>${currency} ${amount}</strong> has been <strong>rejected</strong> by our compliance team.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>The full amount has been <strong>refunded to your account</strong> and is available immediately.</p>
      <p class="note">If you believe this was in error, please contact support.</p>`;
    await send({ to, subject: 'Transfer rejected — Lumina Bank', html: layout('Transfer Rejected', body) });
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
      subject: `Dispute ${resolved ? 'resolved' : 'update'} — Lumina Bank`,
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
      subject: `Insurance quote ${accepted ? 'accepted' : 'update'} — Lumina Bank`,
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
      subject: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} — Lumina Bank`,
      html: layout(`2FA ${enabled ? 'Enabled' : 'Disabled'}`, body),
    });
  },

  async sendCardBlocked(to: string, last4: string): Promise<void> {
    const body = `
      <p>Your Lumina Bank card ending in <strong>${last4}</strong> has been <strong>blocked</strong> by our team.</p>
      <p>The card cannot be used for any transactions until it is unblocked.</p>
      <p class="note">If this was unexpected, please contact support immediately.</p>`;
    await send({ to, subject: `Card ending ${last4} blocked — Lumina Bank`, html: layout('Card Blocked', body) });
  },

  async sendSecurityAlert(to: string, opts: { event: string; detail?: string }): Promise<void> {
    const body = `
      <p>A security event was detected on your Lumina Bank account: <strong>${opts.event}</strong>.</p>
      ${opts.detail ? `<p>${opts.detail}</p>` : ''}
      <p>All active sessions have been signed out as a precaution.</p>
      <p class="note">If this was you, simply log back in. If you did not take this action, please <strong>change your password immediately</strong> and contact support.</p>`;
    await send({ to, subject: `Security alert — Lumina Bank`, html: layout('Security Alert', body) });
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
      subject: `Crypto order ${approved ? 'approved' : 'rejected'} — Lumina Bank`,
      html: layout(`Crypto Order ${approved ? 'Approved' : 'Rejected'}`, body),
    });
  },
};
