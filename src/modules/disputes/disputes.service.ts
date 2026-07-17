import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { DisputeStatus, NotificationType } from '@prisma/client';

export class DisputesService {
  async createDispute(userId: string, data: { subject: string; description: string; transactionId?: string }) {
    const { subject, description, transactionId } = data;

    if (transactionId) {
      const tx = await prisma.transaction.findFirst({ where: { id: transactionId, account: { userId } } });
      if (!tx) throw new AppError('Transaction not found', 404);
    }

    const dispute = await prisma.dispute.create({
      data: { userId, subject, description, transactionId: transactionId ?? null, status: DisputeStatus.OPEN },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SYSTEM,
        title: 'Dispute Submitted',
        body: `Your dispute "${subject}" has been received. We'll review it and respond within 3–5 business days.`,
      },
    });

    return dispute;
  }

  async getDisputes(userId: string) {
    return prisma.dispute.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDispute(id: string, userId: string) {
    const dispute = await prisma.dispute.findFirst({ where: { id, userId } });
    if (!dispute) throw new AppError('Dispute not found', 404);
    return dispute;
  }
}

export const disputesService = new DisputesService();
