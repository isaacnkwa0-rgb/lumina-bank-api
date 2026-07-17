import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { getPagination, buildPaginationMeta } from '../../shared/utils/pagination';

export interface ListNotificationsOptions {
  page?: number;
  limit?: number;
}

export class NotificationsService {
  async list(userId: string, options: ListNotificationsOptions = {}) {
    const { skip, take, page, limit } = getPagination({
      page: options.page ?? 1,
      limit: options.limit ?? 20,
    });

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return { notifications, meta: buildPaginationMeta(total, page, limit) };
  }

  async markRead(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new AppError('Notification not found', 404, ErrorCodes.NOT_FOUND);
    if (notification.isRead) return notification;
    return prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: string) {
    const { count } = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: count };
  }

  async delete(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) throw new AppError('Notification not found', 404, ErrorCodes.NOT_FOUND);
    await prisma.notification.delete({ where: { id } });
  }

  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({ where: { userId, isRead: false } });
    return { unreadCount: count };
  }
}

export const notificationsService = new NotificationsService();
