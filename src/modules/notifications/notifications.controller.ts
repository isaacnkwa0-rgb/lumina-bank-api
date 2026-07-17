import { Request, Response, NextFunction } from 'express';
import { notificationsService } from './notifications.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class NotificationsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = req.query as any;
      const result = await notificationsService.list(req.user!.id, {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      });
      sendSuccess(res, result.notifications, 'Notifications retrieved', 200, result.meta);
    } catch (err) {
      next(err);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const notification = await notificationsService.markRead((req.params.id as string), req.user!.id);
      sendSuccess(res, notification, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.markAllRead(req.user!.id);
      sendSuccess(res, result, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.delete((req.params.id as string), req.user!.id);
      sendSuccess(res, null, 'Notification deleted');
    } catch (err) {
      next(err);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.getUnreadCount(req.user!.id);
      sendSuccess(res, result, 'Unread count retrieved');
    } catch (err) {
      next(err);
    }
  }
}

export const notificationsController = new NotificationsController();
