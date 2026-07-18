import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { DisputeStatus, NotificationType } from '@prisma/client';
import { ErrorCodes } from '../../shared/utils/api-response';

export class DisputesService {
  async createDispute(userId: string, data: { subject: string; description: string; transactionId?: string }) {
    const { subject, description, transactionId } = data;

    if (transactionId) {
      const tx = await prisma.transaction.findFirst({ where: { id: transactionId, account: { userId } } });
      if (!tx) throw new AppError('Transaction not found', 404, ErrorCodes.NOT_FOUND);
    }

    const dispute = await prisma.dispute.create({
      data: { userId, subject, description, transactionId: transactionId ?? null, status: DisputeStatus.OPEN },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SYSTEM,
        title: 'Dispute Submitted',
        body: `Your dispute "${subject}" has been received. We'll review it within 3–5 business days.`,
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
    const dispute = await prisma.dispute.findFirst({
      where: { id, userId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!dispute) throw new AppError('Dispute not found', 404, ErrorCodes.NOT_FOUND);
    return dispute;
  }

  async closeDispute(id: string, userId: string) {
    const dispute = await prisma.dispute.findFirst({ where: { id, userId } });
    if (!dispute) throw new AppError('Dispute not found', 404, ErrorCodes.NOT_FOUND);
    if (dispute.status !== DisputeStatus.OPEN)
      throw new AppError('Only open disputes can be closed', 400, ErrorCodes.VAL_001);

    const updated = await prisma.dispute.update({
      where: { id },
      data: { status: DisputeStatus.REJECTED, resolution: 'Closed by customer' },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SYSTEM,
        title: 'Dispute Closed',
        body: `Your dispute "${dispute.subject}" has been closed.`,
      },
    });

    return updated;
  }
}

export const disputesService = new DisputesService();
