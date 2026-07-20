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

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.tier, user.status);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tier: user.tier,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async login(
    email: string,
    password: string,
    deviceInfo?: { name?: string; userAgent?: string; ip?: string }
  ) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new AppError('Invalid email or password', 401, ErrorCodes.AUTH_001);
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
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });
      throw new AppError('Invalid email or password', 401, ErrorCodes.AUTH_001);
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
      return { requiresTwoFactor: true, tempToken };
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role, user.tier, user.status, deviceInfo);

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
        role: user.role,
        tier: user.tier,
        isEmailVerified: user.isEmailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  async verifyTwoFactor(tempToken: string, totpCode: string, deviceInfo?: any) {
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
    if (!user || !user.twoFactorSecret) {
      throw new AppError('User not found', 404, ErrorCodes.AUTH_004);
    }

    const secret = decrypt(user.twoFactorSecret);
    const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: totpCode, window: 1 });

    if (!valid) {
      throw new AppError('Invalid 2FA code', 401, ErrorCodes.AUTH_006);
    }

    return this.issueTokens(user.id, user.email, user.role, user.tier, user.status, deviceInfo);
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

  async setup2FA(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    if (user.twoFactorEnabled) throw new AppError('2FA is already enabled', 400, ErrorCodes.CONFLICT);

    const secret = speakeasy.generateSecret({ name: `Lumina Bank (${user.email})`, length: 20 });
    const encrypted = encrypt(secret.base32);

    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: encrypted } });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    return { secret: secret.base32, qrCode: qrCodeUrl };
  }

  async enable2FA(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new AppError('2FA setup not initiated', 400, ErrorCodes.AUTH_005);

    const secret = decrypt(user.twoFactorSecret);
    const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });

    if (!valid) throw new AppError('Invalid 2FA code', 401, ErrorCodes.AUTH_006);

    const codes = Array.from({ length: 10 }, () => randomBytes(4).toString('hex').toUpperCase());
    const hashedCodes = codes.map(c => createHash('sha256').update(c).digest('hex'));

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorRecoveryCodes: hashedCodes },
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

    if (user.twoFactorSecret) {
      const secret = decrypt(user.twoFactorSecret);
      const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
      if (!valid) throw new AppError('Invalid 2FA code', 401, ErrorCodes.AUTH_006);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
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
    return { message: 'Password changed successfully' };
  }

  async verifyPassword(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new AppError('Incorrect password', 401, ErrorCodes.AUTH_001);
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
}

export const authService = new AuthService();
