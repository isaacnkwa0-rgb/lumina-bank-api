import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { KycStatus, NotificationType } from '@prisma/client';

export class KycService {
  async getStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, kycDocuments: true },
    });
    if (!user) throw new AppError('User not found', 404);
    return { status: user.kycStatus, documents: user.kycDocuments };
  }

  async submit(userId: string, urls: { idFrontUrl: string; idBackUrl: string }) {
    const kycDocuments = { idFront: urls.idFrontUrl, idBack: urls.idBackUrl };

    const user = await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: KycStatus.PENDING, kycDocuments },
      select: { id: true, kycStatus: true },
    });

    await prisma.notification.create({
      data: {
        userId,
        title: 'KYC Submitted',
        body: 'Your KYC documents have been submitted and are under review. We will notify you once verified.',
        type: NotificationType.SYSTEM,
      },
    });

    return { status: user.kycStatus, message: 'Documents submitted successfully and are under review' };
  }

  async getDocuments(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycDocuments: true, kycStatus: true },
    });
    if (!user) throw new AppError('User not found', 404);
    return { documents: user.kycDocuments, status: user.kycStatus };
  }
}

export default new KycService();
export const kycService = new KycService();
