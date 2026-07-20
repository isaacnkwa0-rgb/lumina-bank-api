import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { KycStatus, NotificationType } from '@prisma/client';

interface KycFiles {
  idFront?: Express.Multer.File[];
  idBack?: Express.Multer.File[];
}

export class KycService {
  async getStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        kycStatus: true,
        kycDocuments: true,
      },
    });
    if (!user) throw new AppError('User not found', 404);
    return {
      status: user.kycStatus,
      documents: user.kycDocuments,
    };
  }

  async submit(userId: string, files: KycFiles) {
    const idFront = files.idFront?.[0];
    const idBack = files.idBack?.[0];

    if (!idFront || !idBack) {
      throw new AppError('Both documents are required: idFront and idBack', 400);
    }

    const kycDocuments = {
      idFront: idFront.path || idFront.filename,
      idBack: idBack.path || idBack.filename,
    };

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KycStatus.PENDING,
        kycDocuments,
        kycSubmittedAt: new Date(),
      },
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

    return {
      status: user.kycStatus,
      message: 'Documents submitted successfully and are under review',
    };
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
