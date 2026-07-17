import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

function createTransporter(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    logger.warn('SMTP not configured — emails will be logged only');
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

const transporter = createTransporter();

async function send(opts: MailOptions): Promise<void> {
  if (!transporter) {
    logger.info('[MAIL STUB]', { to: opts.to, subject: opts.subject });
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${env.FROM_NAME}" <${env.FROM_EMAIL}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    logger.error('Failed to send email', { to: opts.to, err });
    throw err;
  }
}

// ── Branded email wrapper ──────────────────────────────────────────────────────

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
  <div class="foot">© ${new Date().getFullYear()} Lumina Bank · This email was sent to you because an action was taken on your account.</div>
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
};
