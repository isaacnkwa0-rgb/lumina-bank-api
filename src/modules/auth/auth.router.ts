import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authController } from './auth.controller';
import { authService } from './auth.service';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { authLimiter } from '../../middleware/rate-limit.middleware';
import { AppError } from '../../middleware/error.middleware';
import { prisma } from '../../config/database';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  twoFaEnableSchema,
  twoFaDisableSchema,
  twoFaVerifySchema,
} from './auth.schema';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/logout', validate(refreshTokenSchema), authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification', authLimiter, validate(resendVerificationSchema), authController.resendVerification);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/2fa/setup', authenticate, authController.setup2FA);
router.post('/2fa/enable', authenticate, validate(twoFaEnableSchema), authController.enable2FA);
router.post('/2fa/disable', authenticate, validate(twoFaDisableSchema), authController.disable2FA);
router.post('/2fa/verify', authLimiter, validate(twoFaVerifySchema), authController.verifyTwoFactor);
router.post('/2fa/regenerate-recovery-codes', authenticate, authController.regenerateRecoveryCodes);
router.post('/change-password', authenticate, validate(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })), authController.changePassword);
router.post('/verify-password', authenticate, validate(z.object({ password: z.string().min(1) })), authController.verifyPassword);
router.get('/me', authenticate, authController.me);

router.post('/send-phone-otp', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.sendPhoneOtp(req.user!.id);
    res.json({ message: 'Verification code sent to your phone' });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-phone-otp', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    if (!code) throw new AppError('Code is required', 400, 'AUTH_PHONE_003');
    await authService.verifyPhoneOtp(req.user!.id, code);
    res.json({ message: 'Phone number verified successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/onboarding-status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { onboardingStep: true, kycStatus: true, isEmailVerified: true, isPhoneVerified: true },
    });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
