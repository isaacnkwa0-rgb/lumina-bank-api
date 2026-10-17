import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { randomBytes, createHash } from 'crypto';
import * as crypto from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { generateAccountNumber, generateSortCode, generateIBAN } from '../../shared/utils/account-number';
import { hashToken, encrypt, decrypt } from '../../shared/utils/crypto';
import { mailService } from '../../shared/services/mail.service';
import { notifyAdmin } from '../../shared/utils/notify-admin';
import { AccountType } from '@prisma/client';

function encryptSsn(ssn: string): string {
  const key = Buffer.from(process.env.SSN_ENCRYPTION_KEY || 'lumina_ssn_key_32_bytes_fallback!', 'utf8').slice(0, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(ssn, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;
const OTP_EXPIRY_MINUTES = 10;

export class AuthService {
  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
    gender?: string;
    dateOfBirth?: string;
    nationality?: string;
    countryOfResidence?: string;
    taxResidency?: string[];
    accountType?: string;
    ssn?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('Email already registered', 409, ErrorCodes.CONFLICT);
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          passwordHash,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          nationality: data.nationality,
          countryOfResidence: data.countryOfResidence,
          taxResidency: data.taxResidency,
          accountType: data.accountType,
          ssnEncrypted: data.ssn ? encryptSsn(data.ssn) : undefined,
        },
      });

      await tx.profile.create({ data: { userId: newUser.id } });

      const accountNumber = generateAccountNumber();
      const sortCode = generateSortCode();
      const iban = generateIBAN('GBP');
      await tx.account.create({
        data: {
          userId: newUser.id,
          accountNumber,
          sortCode,
          iban,
          type: AccountType.CURRENT,
          currency: 'GBP',
          balance: 0,
          availableBalance: 0,
          isDefault: true,
        },
      });

      return newUser;
    });

    await this.sendEmailOtp(user.id, user.email, 'EMAIL_VERIFICATION');

    notifyAdmin({ type: 'NEW_REGISTRATION', firstName: user.firstName, lastName: user.lastName, email: user.email, accountType: data.accountType });

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.tier, user.status);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        nationality: user.nationality,
        role: user.role,
        tier: user.tier,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        onboardingStep: user.onboardingStep,
        createdAt: user.createdAt,
        profile: null,
      },
    };
  }

  async login(
    identifier: string,
    password: string,
    deviceInfo?: { name?: string; userAgent?: string; ip?: string }
  ) {
    // Accept either email or account number
    const isEmail = identifier.includes('@');
    let user;
    if (isEmail) {
      user = await prisma.user.findUnique({ where: { email: identifier } });
    } else {
      const account = await prisma.account.findFirst({
        where: { accountNumber: identifier },
        select: { userId: true },
      });
      if (account) {
        user = await prisma.user.findUnique({ where: { id: account.userId } });
      }
    }

    if (!user) {
      throw new AppError('Invalid credentials', 401, ErrorCodes.AUTH_001);
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('Account suspended. Please contact support.', 403, ErrorCodes.AUTH_002);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      throw new AppError(
        `Account locked. Try again in ${minutesLeft} minutes.`,
        401,
        ErrorCodes.AUTH_002
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      const attempts = user.failedLoginAttempts + 1;
      const updateData: any = { failedLoginAttempts: attempts };

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
        updateData.failedLoginAttempts = 0;
        mailService.sendAccountLockout(user.email, LOCK_DURATION_MINUTES).catch(() => {});
        notifyAdmin({ type: 'ACCOUNT_LOCKED', firstName: user.firstName, lastName: user.lastName, email: user.email, lockDurationMinutes: LOCK_DURATION_MINUTES });
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });
      throw new AppError('Invalid credentials', 401, ErrorCodes.AUTH_001);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { sub: user.id, type: '2fa_pending' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '5m' }
      );
      const method = user.twoFactorMethod ?? 'TOTP';
      if (method === 'EMAIL' || method === 'BOTH') {
        this.sendEmailOtp(user.id, user.email, 'TWO_FA').catch(() => {});
      }
      return { requiresTwoFactor: true, tempToken, twoFactorMethod: method };
    }

    const [tokens, profile] = await Promise.all([
      this.issueTokens(user.id, user.email, user.role, user.tier, user.status, deviceInfo),
      prisma.profile.findUnique({
        where: { userId: user.id },
        select: {
          avatarUrl: true, occupation: true, employer: true,
          annualIncome: true, preferredCurrency: true,
          preferredLanguage: true, notificationPreferences: true,
        },
      }),
    ]);

    logger.info('User logged in', { userId: user.id, email: user.email });

    return {
      requiresTwoFactor: false,
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        nationality: user.nationality,
        address: user.address,
        role: user.role,
        tier: user.tier,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorMethod: user.twoFactorMethod,
        kycStatus: user.kycStatus,
        onboardingStep: user.onboardingStep,
        createdAt: user.createdAt,
        profile,
      },
    };
  }

  async verifyTwoFactor(tempToken: string, totpCode: string | null, recoveryCode: string | null, deviceInfo?: any) {
    let payload: any;
    try {
      payload = jwt.verify(tempToken, env.JWT_ACCESS_SECRET);
    } catch {
      throw new AppError('Invalid or expired session', 401, ErrorCodes.AUTH_004);
    }

    if (payload.type !== '2fa_pending') {
      throw new AppError('Invalid token type', 401, ErrorCodes.AUTH_004);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.AUTH_004);
    }

    if (recoveryCode) {
      const stored = user.twoFactorRecoveryCodes as string[] | null;
      if (!stored || stored.length === 0) {
        throw new AppError('No recovery codes available', 400, ErrorCodes.AUTH_006);
      }
      const hashed = createHash('sha256').update(recoveryCode.toUpperCase()).digest('hex');
      const idx = stored.indexOf(hashed);
      if (idx === -1) {
        throw new AppError('Invalid recovery code', 401, ErrorCodes.AUTH_006);
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorRecoveryCodes: stored.filter((_, i) => i !== idx) },
      });
      return this.issueTokens(user.id, user.email, user.role, user.tier, user.status, deviceInfo);
    }

    if (!totpCode) throw new AppError('Verification code is required', 400, ErrorCodes.AUTH_006);

    const method = user.twoFactorMethod ?? 'TOTP';

    if (method === 'EMAIL') {
      await this.verifyOtp(user.id, totpCode, 'TWO_FA');
      return this.issueTokens(user.id, user.email, user.role, user.tier, user.status, deviceInfo);
    }

    if (method === 'BOTH') {
      // Accept either TOTP or email OTP
      let valid = false;
      if (user.twoFactorSecret) {
        const secret = decrypt(user.twoFactorSecret);
        valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: totpCode, window: 1 });
      }
      if (!valid) {
        // Try email OTP as fallback
        await this.verifyOtp(user.id, totpCode, 'TWO_FA');
      }
      return this.issueTokens(user.id, user.email, user.role, user.tier, user.status, deviceInfo);
    }

    // Default: TOTP
    if (!user.twoFactorSecret) throw new AppError('User not found', 404, ErrorCodes.AUTH_004);
    const secret = decrypt(user.twoFactorSecret);
    const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: totpCode, window: 1 });
    if (!valid) throw new AppError('Invalid 2FA code', 401, ErrorCodes.AUTH_006);

    return this.issueTokens(user.id, user.email, user.role, user.tier, user.status, deviceInfo);
  }

  async resendTwoFaOtp(tempToken: string) {
    let payload: any;
    try {
      payload = jwt.verify(tempToken, env.JWT_ACCESS_SECRET);
    } catch {
      throw new AppError('Invalid or expired session', 401, ErrorCodes.AUTH_004);
    }
    if (payload.type !== '2fa_pending') throw new AppError('Invalid token type', 401, ErrorCodes.AUTH_004);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.AUTH_004);
    await this.sendEmailOtp(user.id, user.email, 'TWO_FA');
    return { sent: true };
  }

  async refreshTokens(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      throw new AppError('Invalid or expired refresh token', 401, ErrorCodes.AUTH_003);
    }

    // Reuse detected: token was already revoked but is being replayed — possible theft
    if (stored.revokedAt && stored.expiresAt > new Date()) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const victim = await prisma.user.findUnique({ where: { id: stored.userId }, select: { email: true } });
      if (victim) {
        mailService.sendSecurityAlert(victim.email, {
          event: 'Suspicious session activity detected',
          detail: 'A previously used refresh token was replayed. This may indicate your session was stolen.',
        }).catch(() => {});
      }
      logger.warn('Refresh token reuse detected — all sessions revoked', { userId: stored.userId });
      throw new AppError('Invalid or expired refresh token', 401, ErrorCodes.AUTH_003);
    }

    if (stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401, ErrorCodes.AUTH_003);
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw new AppError('User not found', 401, ErrorCodes.AUTH_004);

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    return this.issueTokens(user.id, user.email, user.role, user.tier, user.status);
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyEmail(email: string, code: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    if (user.isEmailVerified) throw new AppError('Email already verified', 400, ErrorCodes.CONFLICT);

    await this.verifyOtp(user.id, code, 'EMAIL_VERIFICATION');

    await prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true } });
    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;
    if (user.isEmailVerified) throw new AppError('Email already verified', 400, ErrorCodes.CONFLICT);
    await this.sendEmailOtp(user.id, email, 'EMAIL_VERIFICATION');
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;
    await this.sendEmailOtp(user.id, email, 'PASSWORD_RESET');
  }

  async resendOtp(email: string, type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' | 'LOGIN') {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;
    await this.sendEmailOtp(user.id, email, type);
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);

    await this.verifyOtp(user.id, code, 'PASSWORD_RESET');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.logoutAll(user.id);
    mailService.sendPasswordChanged(user.email).catch(() => {});
    return { message: 'Password reset successfully' };
  }

  async setup2FA(userId: string, method: string = 'TOTP') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    if (user.twoFactorEnabled) throw new AppError('2FA is already enabled', 400, ErrorCodes.CONFLICT);

    if (method === 'EMAIL' || method === 'BOTH') {
      // Store chosen method, send a setup OTP to confirm email access
      await prisma.user.update({ where: { id: userId }, data: { twoFactorMethod: method as any } });
    }

    if (method === 'EMAIL') {
      await this.sendEmailOtp(userId, user.email, 'TWO_FA_SETUP');
      const masked = user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
      return { method: 'EMAIL', maskedEmail: masked };
    }

    // TOTP or BOTH — generate secret + QR
    const secret = speakeasy.generateSecret({ name: `Lumina Bank (${user.email})`, length: 20 });
    const encrypted = encrypt(secret.base32);
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: encrypted, twoFactorMethod: method as any } });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    return { method, secret: secret.base32, qrCode: qrCodeUrl };
  }

  async enable2FA(userId: string, token: string, method?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);

    const resolvedMethod = method ?? user.twoFactorMethod ?? 'TOTP';

    if (resolvedMethod === 'EMAIL') {
      await this.verifyOtp(userId, token, 'TWO_FA_SETUP');
    } else {
      if (!user.twoFactorSecret) throw new AppError('2FA setup not initiated', 400, ErrorCodes.AUTH_005);
      const secret = decrypt(user.twoFactorSecret);
      const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
      if (!valid) throw new AppError('Invalid 2FA code', 401, ErrorCodes.AUTH_006);
    }

    const codes = Array.from({ length: 10 }, () => randomBytes(4).toString('hex').toUpperCase());
    const hashedCodes = codes.map(c => createHash('sha256').update(c).digest('hex'));

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorMethod: resolvedMethod as any, twoFactorRecoveryCodes: hashedCodes },
    });
    mailService.send2FAChanged(user.email, true).catch(() => {});
    return { message: 'Two-factor authentication enabled', recoveryCodes: codes };
  }

  async getRecoveryCodes(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    if (!user.twoFactorEnabled) throw new AppError('2FA is not enabled', 400, ErrorCodes.AUTH_005);

    const codes = Array.from({ length: 10 }, () => randomBytes(4).toString('hex').toUpperCase());
    const hashedCodes = codes.map(c => createHash('sha256').update(c).digest('hex'));

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorRecoveryCodes: hashedCodes },
    });
    return { recoveryCodes: codes };
  }

  async disable2FA(userId: string, password: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) throw new AppError('Invalid password', 401, ErrorCodes.AUTH_001);

    const method = user.twoFactorMethod ?? 'TOTP';
    if (method === 'EMAIL') {
      await this.verifyOtp(userId, token, 'TWO_FA_SETUP');
    } else if (user.twoFactorSecret) {
      const secret = decrypt(user.twoFactorSecret);
      const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
      if (!valid) throw new AppError('Invalid 2FA code', 401, ErrorCodes.AUTH_006);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorMethod: 'TOTP' },
    });
    mailService.send2FAChanged(user.email, false).catch(() => {});
    return { message: '2FA disabled successfully' };
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: any,
    tier: any,
    status: any,
    deviceInfo?: { name?: string; userAgent?: string; ip?: string }
  ) {
    const accessToken = jwt.sign(
      { sub: userId, email, role, tier, status },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES as any }
    );

    const refreshTokenValue = require('crypto').randomBytes(64).toString('hex');
    const tokenHash = hashToken(refreshTokenValue);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: refreshTokenValue, expiresIn: 900 };
  }

  private async sendEmailOtp(userId: string, email: string, type: string) {
    const recent = await prisma.otpCode.findFirst({
      where: { userId, type, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent) throw new AppError('Please wait 60 seconds before requesting another code', 429, ErrorCodes.RATE_LIMIT);

    const code = String(require('crypto').randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.otpCode.deleteMany({ where: { userId, type } });
    await prisma.otpCode.create({ data: { userId, code, type, expiresAt } });

    const sendPromise = type === 'EMAIL_VERIFICATION'
      ? mailService.sendVerificationOtp(email, code)
      : type === 'PASSWORD_RESET'
        ? mailService.sendPasswordResetOtp(email, code)
        : type === 'TRANSFER_AUTH'
          ? mailService.sendTransferOtp(email, code)
          : mailService.sendLoginOtp(email, code);

    sendPromise.catch((err: Error) => {
      logger.error('Failed to send OTP email', { email, type, err: err.message });
      // Fallback: log code so testing works even without email delivery
      logger.warn(`[DEV FALLBACK] OTP code for ${email} (${type}): ${code}`);
    });
    logger.info(`OTP sent for ${type}`, { email });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new AppError('Current password is incorrect', 401, ErrorCodes.AUTH_001);
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.logoutAll(userId);
    mailService.sendPasswordChanged(user.email).catch(() => {});
    notifyAdmin({ type: 'PASSWORD_CHANGED', firstName: user.firstName, lastName: user.lastName, email: user.email });
    return { message: 'Password changed successfully' };
  }

  async verifyPassword(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new AppError('Incorrect password', 401, ErrorCodes.AUTH_001);
    return { verified: true };
  }

  async setTransferPin(userId: string, pin: string, currentPin?: string) {
    if (!/^\d{6}$/.test(pin)) throw new AppError('PIN must be exactly 6 digits', 400, ErrorCodes.VAL_001);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { transferPinHash: true } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    if (user.transferPinHash) {
      if (!currentPin) throw new AppError('Current PIN is required to change your PIN', 400, ErrorCodes.VAL_001);
      const match = await bcrypt.compare(currentPin, user.transferPinHash);
      if (!match) throw new AppError('Current PIN is incorrect', 401, ErrorCodes.AUTH_001);
    }
    const hash = await bcrypt.hash(pin, SALT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { transferPinHash: hash } });
    return { set: true };
  }

  async verifyTransferPin(userId: string, pin: string) {
    if (!/^\d{6}$/.test(pin)) throw new AppError('Invalid PIN format', 400, ErrorCodes.VAL_001);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { transferPinHash: true } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    if (!user.transferPinHash) throw new AppError('Transfer PIN not set up', 400, ErrorCodes.VAL_001);
    const match = await bcrypt.compare(pin, user.transferPinHash);
    if (!match) throw new AppError('Incorrect PIN', 401, ErrorCodes.AUTH_001);
    return { verified: true };
  }

  async getTransferPinStatus(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { transferPinHash: true } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    return { hasPin: !!user.transferPinHash };
  }

  async requestTransferOtp(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    await this.sendEmailOtp(userId, user.email, 'TRANSFER_AUTH');
    const masked = user.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length - 2, 2)) + b.slice(-2) + c);
    return { sent: true, maskedEmail: masked };
  }

  async verifyTransferOtp(userId: string, code: string) {
    await this.verifyOtp(userId, code, 'TRANSFER_AUTH');
    return { verified: true };
  }

  private async verifyOtp(userId: string, code: string, type: string) {
    const otp = await prisma.otpCode.findFirst({
      where: { userId, type, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.code !== code) {
      throw new AppError('Invalid or expired OTP code', 401, ErrorCodes.AUTH_006);
    }

    await prisma.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  }

  async sendPhoneOtp(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!user?.phone) throw new AppError('No phone number on file', 400, ErrorCodes.NOT_FOUND);

    const recent = await prisma.otpCode.findFirst({
      where: { userId, type: 'PHONE_VERIFY', createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent) throw new AppError('Please wait 60 seconds before requesting another code', 429, ErrorCodes.RATE_LIMIT);

    const code = String(require('crypto').randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await prisma.otpCode.deleteMany({ where: { userId, type: 'PHONE_VERIFY' } });
    await prisma.otpCode.create({ data: { userId, code, type: 'PHONE_VERIFY', expiresAt } });

    // In production, send via SMS provider (Twilio etc.)
    logger.warn(`[DEV] Phone OTP for ${user.phone} (PHONE_VERIFY): ${code}`);
    return { message: 'Verification code sent to your phone number' };
  }

  async verifyPhoneOtp(userId: string, code: string) {
    await this.verifyOtp(userId, code, 'PHONE_VERIFY');
    await prisma.user.update({ where: { id: userId }, data: { isPhoneVerified: true } });
    return { message: 'Phone number verified successfully' };
  }
}

export const authService = new AuthService();
