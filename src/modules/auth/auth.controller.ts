import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      sendCreated(res, result, 'Registration successful. Please verify your email.');
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body.email, req.body.password, {
        name: req.body.deviceName,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
      sendSuccess(res, result, 'Login successful');
    } catch (err) {
      next(err);
    }
  }

  async verifyTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyTwoFactor(req.body.tempToken, req.body.token, {
        userAgent: req.get('user-agent'),
        ip: req.ip,
      });
      sendSuccess(res, result, 'Two-factor authentication successful');
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refreshTokens(req.body.refreshToken);
      sendSuccess(res, result, 'Token refreshed');
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logout(req.body.refreshToken);
      sendSuccess(res, null, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logoutAll(req.user!.id);
      sendSuccess(res, null, 'Logged out from all devices');
    } catch (err) {
      next(err);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyEmail(req.body.email, req.body.code);
      sendSuccess(res, result, 'Email verified');
    } catch (err) {
      next(err);
    }
  }

  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.resendVerification(req.body.email);
      sendSuccess(res, null, 'Verification email sent if account exists');
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.forgotPassword(req.body.email);
      sendSuccess(res, null, 'Password reset email sent if account exists');
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resetPassword(
        req.body.email,
        req.body.code,
        req.body.newPassword
      );
      sendSuccess(res, result, 'Password reset successfully');
    } catch (err) {
      next(err);
    }
  }

  async setup2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.setup2FA(req.user!.id);
      sendSuccess(res, result, '2FA setup initiated');
    } catch (err) {
      next(err);
    }
  }

  async enable2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.enable2FA(req.user!.id, req.body.token);
      sendSuccess(res, result, '2FA enabled');
    } catch (err) {
      next(err);
    }
  }

  async disable2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.disable2FA(req.user!.id, req.body.password, req.body.token);
      sendSuccess(res, result, '2FA disabled');
    } catch (err) {
      next(err);
    }
  }

  async regenerateRecoveryCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.getRecoveryCodes(req.user!.id);
      sendSuccess(res, result, 'Recovery codes regenerated');
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
      sendSuccess(res, result, 'Password changed successfully');
    } catch (err) {
      next(err);
    }
  }

  async verifyPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyPassword(req.user!.id, req.body.password);
      sendSuccess(res, result, 'Password verified');
    } catch (err) {
      next(err);
    }
  }

  async setTransferPin(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.setTransferPin(req.user!.id, req.body.pin, req.body.currentPin);
      sendSuccess(res, result, 'Transfer PIN set successfully');
    } catch (err) { next(err); }
  }

  async verifyTransferPin(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyTransferPin(req.user!.id, req.body.pin);
      sendSuccess(res, result, 'PIN verified');
    } catch (err) { next(err); }
  }

  async getTransferPinStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.getTransferPinStatus(req.user!.id);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  }

  async requestTransferOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.requestTransferOtp(req.user!.id);
      sendSuccess(res, result, 'Transfer authorisation code sent');
    } catch (err) {
      next(err);
    }
  }

  async verifyTransferOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyTransferOtp(req.user!.id, req.body.code);
      sendSuccess(res, result, 'Transfer authorised');
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await (await import('../../config/database')).prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          tier: true,
          status: true,
          isEmailVerified: true,
          twoFactorEnabled: true,
          kycStatus: true,
          createdAt: true,
        },
      });
      sendSuccess(res, user, 'User retrieved');
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
