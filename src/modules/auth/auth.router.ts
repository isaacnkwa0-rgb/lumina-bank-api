import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { authLimiter } from '../../middleware/rate-limit.middleware';
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
router.post('/transfer-pin/setup', authenticate, validate(z.object({ pin: z.string().length(6).regex(/^\d+$/), currentPin: z.string().length(6).regex(/^\d+$/).optional() })), authController.setTransferPin);
router.post('/transfer-pin/verify', authenticate, validate(z.object({ pin: z.string().length(6).regex(/^\d+$/) })), authController.verifyTransferPin);
router.get('/transfer-pin/status', authenticate, authController.getTransferPinStatus);
router.post('/transfer-otp', authenticate, authController.requestTransferOtp);
router.post('/verify-transfer-otp', authenticate, validate(z.object({ code: z.string().length(6) })), authController.verifyTransferOtp);
router.get('/me', authenticate, authController.me);

router.get('/onboarding-status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { onboardingStep: true, kycStatus: true, isEmailVerified: true },
    });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
