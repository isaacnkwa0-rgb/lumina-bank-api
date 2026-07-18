import { Language } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';

export class UsersService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
        nationality: true,
        address: true,
        tier: true,
        role: true,
        status: true,
        kycStatus: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        profile: {
          select: {
            avatarUrl: true,
            occupation: true,
            employer: true,
            annualIncome: true,
            preferredCurrency: true,
            preferredLanguage: true,
            notificationPreferences: true,
          },
        },
      },
    });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      dateOfBirth?: string;
      nationality?: string;
      address?: object;
      occupation?: string;
      employer?: string;
      annualIncome?: number;
      preferredCurrency?: string;
      preferredLanguage?: Language;
    }
  ) {
    const { occupation, employer, annualIncome, preferredCurrency, preferredLanguage, ...userFields } = data;

    const profileData: any = {};
    if (occupation !== undefined) profileData.occupation = occupation;
    if (employer !== undefined) profileData.employer = employer;
    if (annualIncome !== undefined) profileData.annualIncome = annualIncome;
    if (preferredCurrency !== undefined) profileData.preferredCurrency = preferredCurrency;
    if (preferredLanguage !== undefined) profileData.preferredLanguage = preferredLanguage;

    const [user] = await Promise.all([
      prisma.user.update({
        where: { id: userId },
        data: {
          ...userFields,
          dateOfBirth: userFields.dateOfBirth ? new Date(userFields.dateOfBirth) : undefined,
        },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, updatedAt: true },
      }),
      Object.keys(profileData).length > 0
        ? prisma.profile.update({ where: { userId }, data: profileData })
        : Promise.resolve(null),
    ]);

    return user;
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return prisma.profile.update({ where: { userId }, data: { avatarUrl } });
  }

  async getDevices(userId: string) {
    return prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async removeDevice(deviceId: string, userId: string) {
    const device = await prisma.device.findFirst({ where: { id: deviceId, userId } });
    if (!device) throw new AppError('Device not found', 404, ErrorCodes.NOT_FOUND);
    await prisma.refreshToken.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return prisma.device.delete({ where: { id: deviceId } });
  }

  async getNotificationPreferences(userId: string) {
    const profile = await prisma.profile.findUnique({ where: { userId } });
    return profile?.notificationPreferences;
  }

  async updateNotificationPreferences(userId: string, prefs: Record<string, boolean>) {
    return prisma.profile.update({
      where: { userId },
      data: { notificationPreferences: prefs },
    });
  }
}

export const usersService = new UsersService();
