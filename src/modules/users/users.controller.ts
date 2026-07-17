import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { sendSuccess } from '../../shared/utils/api-response';
import path from 'path';

export class UsersController {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await usersService.getProfile(req.user!.id);
      sendSuccess(res, profile, 'Profile retrieved');
    } catch (err) { next(err); }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.updateProfile(req.user!.id, req.body);
      sendSuccess(res, result, 'Profile updated');
    } catch (err) { next(err); }
  }

  async uploadAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: { code: 'VAL_001', message: 'No file uploaded' } });
        return;
      }
      const avatarUrl = `/uploads/${req.file.filename}`;
      await usersService.updateAvatar(req.user!.id, avatarUrl);
      sendSuccess(res, { avatarUrl }, 'Avatar updated');
    } catch (err) { next(err); }
  }

  async getDevices(req: Request, res: Response, next: NextFunction) {
    try {
      const devices = await usersService.getDevices(req.user!.id);
      sendSuccess(res, devices, 'Devices retrieved');
    } catch (err) { next(err); }
  }

  async removeDevice(req: Request, res: Response, next: NextFunction) {
    try {
      await usersService.removeDevice(req.params.id as string, req.user!.id);
      sendSuccess(res, null, 'Device removed');
    } catch (err) { next(err); }
  }

  async getNotificationPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const prefs = await usersService.getNotificationPreferences(req.user!.id);
      sendSuccess(res, prefs, 'Notification preferences retrieved');
    } catch (err) { next(err); }
  }

  async updateNotificationPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await usersService.updateNotificationPreferences(req.user!.id, req.body);
      sendSuccess(res, result.notificationPreferences, 'Preferences updated');
    } catch (err) { next(err); }
  }
}

export const usersController = new UsersController();
