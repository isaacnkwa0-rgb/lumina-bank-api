import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { StandingOrderFreq, StandingOrderStatus, TransactionType, TransactionCategory, TransactionStatus } from '@prisma/client';
import { generateTransactionReference } from '../../shared/utils/transaction-ref';

function nextDate(from: Date, freq: StandingOrderFreq): Date {
  const d = new Date(from);
  switch (freq) {
    case 'WEEKLY':    d.setDate(d.getDate() + 7);   break;
    case 'BIWEEKLY':  d.setDate(d.getDate() + 14);  break;
    case 'MONTHLY':   d.setMonth(d.getMonth() + 1); break;
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
  }
  return d;
}

export class StandingOrdersService {
  async list(userId: string) {
    return prisma.standingOrder.findMany({
      where: { userId, status: { not: StandingOrderStatus.CANCELLED } },
      include: { fromAccount: { select: { id: true, accountNumber: true, type: true, currency: true } } },
      orderBy: { nextExecutionDate: 'asc' },
    });
  }

  async create(userId: string, data: {
    fromAccountId: string;
    toAccountNumber: string;
    toBankCode: string;
    toAccountName: string;
    amount: number;
    description: string;
    frequency: StandingOrderFreq;
    startDate: string;
    endDate?: string;
  }) {
    const account = await prisma.account.findFirst({
      where: { id: data.fromAccountId, userId, status: 'ACTIVE' },
    });
    if (!account) throw new AppError('Account not found or not active', 404, ErrorCodes.NOT_FOUND);

    const startDate = new Date(data.startDate);

    return prisma.standingOrder.create({
      data: {
        userId,
        fromAccountId: data.fromAccountId,
        toAccountNumber: data.toAccountNumber,
        toBankCode: data.toBankCode,
        toAccountName: data.toAccountName,
        amount: data.amount,
        currency: account.currency,
        description: data.description,
        frequency: data.frequency,
        nextExecutionDate: startDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: StandingOrderStatus.ACTIVE,
      },
      include: { fromAccount: { select: { id: true, accountNumber: true, type: true, currency: true } } },
    });
  }

  async cancel(id: string, userId: string) {
    const order = await prisma.standingOrder.findFirst({ where: { id, userId } });
    if (!order) throw new AppError('Standing order not found', 404, ErrorCodes.NOT_FOUND);
    return prisma.standingOrder.update({
      where: { id },
      data: { status: StandingOrderStatus.CANCELLED },
    });
  }

  async pause(id: string, userId: string) {
    const order = await prisma.standingOrder.findFirst({ where: { id, userId, status: StandingOrderStatus.ACTIVE } });
    if (!order) throw new AppError('Standing order not found or not active', 404, ErrorCodes.NOT_FOUND);
    return prisma.standingOrder.update({ where: { id }, data: { status: StandingOrderStatus.PAUSED } });
  }

  async resume(id: string, userId: string) {
    const order = await prisma.standingOrder.findFirst({ where: { id, userId, status: StandingOrderStatus.PAUSED } });
    if (!order) throw new AppError('Standing order not found or not paused', 404, ErrorCodes.NOT_FOUND);
    return prisma.standingOrder.update({ where: { id }, data: { status: StandingOrderStatus.ACTIVE } });
  }

  // Called by a scheduled job — executes all due standing orders
  async executeDue() {
    const now = new Date();
    const due = await prisma.standingOrder.findMany({
      where: {
        status: StandingOrderStatus.ACTIVE,
        nextExecutionDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      include: { fromAccount: true },
    });

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const order of due) {
      try {
        const account = order.fromAccount;
        if (account.balance.toNumber() < order.amount.toNumber()) {
          results.push({ id: order.id, success: false, error: 'Insufficient funds' });
          continue;
        }

        const reference = generateTransactionReference();
        const balanceBefore = account.balance.toNumber();
        const amount = order.amount.toNumber();
        const newNext = nextDate(order.nextExecutionDate, order.frequency);
        const expired = order.endDate && newNext > order.endDate;

        await prisma.$transaction([
          prisma.account.update({
            where: { id: account.id },
            data: { balance: { decrement: amount }, availableBalance: { decrement: amount } },
          }),
          prisma.transaction.create({
            data: {
              accountId: account.id,
              reference,
              type: TransactionType.DEBIT,
              category: TransactionCategory.TRANSFER,
              amount,
              currency: account.currency,
              balanceBefore,
              balanceAfter: balanceBefore - amount,
              description: `Standing order: ${order.description}`,
              counterpartyName: order.toAccountName,
              counterpartyAccountNumber: order.toAccountNumber,
              counterpartyBank: order.toBankCode,
              status: TransactionStatus.COMPLETED,
            },
          }),
          prisma.standingOrder.update({
            where: { id: order.id },
            data: {
              lastExecutedAt: now,
              nextExecutionDate: newNext,
              status: expired ? StandingOrderStatus.CANCELLED : StandingOrderStatus.ACTIVE,
            },
          }),
          prisma.notification.create({
            data: {
              userId: order.userId,
              type: 'TRANSFER' as any,
              title: 'Standing Order Executed',
              body: `£${amount.toLocaleString()} sent to ${order.toAccountName} — ${order.description}`,
            },
          }),
        ]);

        results.push({ id: order.id, success: true });
      } catch (err: any) {
        results.push({ id: order.id, success: false, error: err.message });
      }
    }

    return { processed: results.length, results };
  }
}

export const standingOrdersService = new StandingOrdersService();
