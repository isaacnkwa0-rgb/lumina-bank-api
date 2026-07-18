import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { InsuranceType, InsuranceStatus, NotificationType } from '@prisma/client';

const BASE_PREMIUMS: Record<InsuranceType, number> = {
  LIFE:     8.50,
  HOME:     12.00,
  CAR:      24.99,
  TRAVEL:   4.99,
  HEALTH:   35.00,
  BUSINESS: 19.99,
};

function estimatePremium(type: InsuranceType, details: Record<string, unknown>): number {
  let base = BASE_PREMIUMS[type];

  if (type === 'LIFE') {
    const age = Number(details.age ?? 30);
    const smoker = details.smoker === true || details.smoker === 'true';
    base = base * (1 + (age - 30) * 0.02) * (smoker ? 1.5 : 1);
  } else if (type === 'CAR') {
    const noClaimsYears = Number(details.noClaimsYears ?? 0);
    base = base * Math.max(0.6, 1 - noClaimsYears * 0.05);
  } else if (type === 'HOME') {
    const rebuildValue = Number(details.rebuildValue ?? 200000);
    base = base * (rebuildValue / 200000) * 0.8 + base * 0.2;
  } else if (type === 'HEALTH') {
    const age = Number(details.age ?? 30);
    base = base * (1 + (age - 30) * 0.025);
  } else if (type === 'BUSINESS') {
    const employees = Number(details.employees ?? 1);
    base = base * Math.max(1, Math.sqrt(employees));
  }

  return Math.round(base * 100) / 100;
}

export class InsuranceService {
  async requestQuote(userId: string, data: { type: string; details: Record<string, unknown>; notes?: string }) {
    const { type, details, notes } = data;

    if (!Object.values(InsuranceType).includes(type as InsuranceType)) {
      throw new AppError(`Invalid insurance type: ${type}`, 400);
    }

    const insuranceType = type as InsuranceType;
    const premium = estimatePremium(insuranceType, details);

    const quote = await prisma.insuranceQuote.create({
      data: {
        userId,
        type: insuranceType,
        status: InsuranceStatus.QUOTED,
        details: details as object,
        premium,
        notes: notes ?? null,
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SYSTEM,
        title: 'Insurance quote ready',
        body: `Your ${insuranceType.toLowerCase()} insurance quote is ready. Estimated premium: £${premium.toFixed(2)}/mo. Our team will be in touch within 24 hours.`,
      },
    });

    return { ...quote, premium };
  }

  async getQuotes(userId: string) {
    return prisma.insuranceQuote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuote(id: string, userId: string) {
    const quote = await prisma.insuranceQuote.findFirst({ where: { id, userId } });
    if (!quote) throw new AppError('Quote not found', 404);
    return quote;
  }

  async acceptQuote(id: string, userId: string) {
    const quote = await prisma.insuranceQuote.findFirst({ where: { id, userId } });
    if (!quote) throw new AppError('Quote not found', 404);
    if (quote.status !== InsuranceStatus.QUOTED) throw new AppError('Quote is not in QUOTED status', 400);

    const updated = await prisma.insuranceQuote.update({
      where: { id },
      data: { status: InsuranceStatus.ACCEPTED },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SYSTEM,
        title: 'Insurance Policy Activated',
        body: `Your ${quote.type.toLowerCase()} insurance policy has been activated. Welcome to Lumina Protect!`,
      },
    });

    return updated;
  }

  async cancelQuote(id: string, userId: string) {
    const quote = await prisma.insuranceQuote.findFirst({ where: { id, userId } });
    if (!quote) throw new AppError('Quote not found', 404);
    if (quote.status === InsuranceStatus.ACCEPTED) throw new AppError('An accepted policy cannot be cancelled here. Please contact support.', 400);
    if (quote.status === InsuranceStatus.DECLINED) throw new AppError('Quote is already closed', 400);

    return prisma.insuranceQuote.update({
      where: { id },
      data: { status: InsuranceStatus.DECLINED, notes: 'Cancelled by customer' },
    });
  }
}

export const insuranceService = new InsuranceService();
