import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { DirectDebitStatus, StandingOrderFreq } from '@prisma/client';

function nextDate(from: Date, freq: StandingOrderFreq): Date {
  const d = new Date(from);
  if (freq === 'WEEKLY')     d.setDate(d.getDate() + 7);
  if (freq === 'BIWEEKLY')   d.setDate(d.getDate() + 14);
  if (freq === 'MONTHLY')    d.setMonth(d.getMonth() + 1);
  if (freq === 'QUARTERLY')  d.setMonth(d.getMonth() + 3);
  return d;
}

export interface CreateDirectDebitData {
  accountId: string;
  originatorName: string;
  originatorRef: string;
  userRef: string;
  amount?: number;
  currency?: string;
  frequency: StandingOrderFreq;
  startDate: string;
}

export class DirectDebitsService {
  async list(userId: string) {
    return prisma.directDebit.findMany({
      where: { userId },
      include: { account: { select: { accountNumber: true, type: true, currency: true } } },
      orderBy: [{ status: 'asc' }, { nextCollectionDate: 'asc' }],
    });
  }

  async get(id: string, userId: string) {
    const dd = await prisma.directDebit.findFirst({ where: { id, userId } });
    if (!dd) throw new AppError('Direct debit not found', 404, ErrorCodes.NOT_FOUND);
    return dd;
  }

  async create(userId: string, data: CreateDirectDebitData) {
    const account = await prisma.account.findFirst({
      where: { id: data.accountId, userId, status: 'ACTIVE' },
    });
    if (!account) throw new AppError('Account not found or not active', 404, ErrorCodes.NOT_FOUND);

    const startDate = new Date(data.startDate);

    return prisma.directDebit.create({
      data: {
        userId,
        accountId: data.accountId,
        originatorName: data.originatorName,
        originatorRef: data.originatorRef,
        userRef: data.userRef,
        amount: data.amount ?? null,
        currency: data.currency ?? account.currency,
        frequency: data.frequency,
        nextCollectionDate: startDate,
        status: 'ACTIVE',
      },
    });
  }

  async cancel(id: string, userId: string) {
    await this.get(id, userId);
    return prisma.directDebit.update({
      where: { id },
      data: { status: DirectDebitStatus.CANCELLED },
    });
  }

  async suspend(id: string, userId: string) {
    const dd = await this.get(id, userId);
    if (dd.status !== DirectDebitStatus.ACTIVE)
      throw new AppError('Only active direct debits can be suspended', 400, ErrorCodes.VAL_001);
    return prisma.directDebit.update({
      where: { id },
      data: { status: DirectDebitStatus.SUSPENDED },
    });
  }

  async resume(id: string, userId: string) {
    const dd = await this.get(id, userId);
    if (dd.status !== DirectDebitStatus.SUSPENDED)
      throw new AppError('Only suspended direct debits can be resumed', 400, ErrorCodes.VAL_001);
    return prisma.directDebit.update({
      where: { id },
      data: { status: DirectDebitStatus.ACTIVE },
    });
  }

  async collectDue() {
    const now = new Date();
    const due = await prisma.directDebit.findMany({
      where: { status: DirectDebitStatus.ACTIVE, nextCollectionDate: { lte: now } },
      include: { account: true },
    });

    const results = [];
    for (const dd of due) {
      if (!dd.amount) {
        // Variable amount — just advance the date; real bank would receive amount from originator
        await prisma.directDebit.update({
          where: { id: dd.id },
          data: {
            nextCollectionDate: nextDate(dd.nextCollectionDate, dd.frequency),
            lastCollectedAt: now,
          },
        });
        results.push({ id: dd.id, status: 'skipped_variable' });
        continue;
      }

      if (Number(dd.account.availableBalance) < Number(dd.amount)) {
        results.push({ id: dd.id, status: 'insufficient_funds' });
        continue;
      }

      const ref = `DD-${Date.now()}-${dd.id.slice(0, 8).toUpperCase()}`;
      await prisma.$transaction([
        prisma.account.update({
          where: { id: dd.accountId },
          data: {
            balance:          { decrement: dd.amount },
            availableBalance: { decrement: dd.amount },
          },
        }),
        prisma.transaction.create({
          data: {
            reference:    ref,
            accountId:    dd.accountId,
            type:         'DEBIT',
            category:     'PAYMENT',
            amount:       dd.amount,
            currency:     dd.currency,
            balanceBefore: dd.account.balance,
            balanceAfter:  Number(dd.account.balance) - Number(dd.amount),
            description:  `Direct Debit — ${dd.originatorName}`,
            counterpartyName: dd.originatorName,
            status: 'COMPLETED',
          },
        }),
        prisma.directDebit.update({
          where: { id: dd.id },
          data: {
            nextCollectionDate: nextDate(dd.nextCollectionDate, dd.frequency),
            lastCollectedAt: now,
          },
        }),
      ]);
      results.push({ id: dd.id, status: 'collected' });
    }
    return results;
  }
}

export const directDebitsService = new DirectDebitsService();
