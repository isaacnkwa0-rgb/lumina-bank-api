import { TransactionType, TransactionCategory, TransactionStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { getPagination, buildPaginationMeta } from '../../shared/utils/pagination';

export class TransactionsService {
  async getTransactions(
    userId: string,
    filters: {
      accountId?: string;
      type?: TransactionType;
      category?: TransactionCategory;
      status?: TransactionStatus;
      dateFrom?: string;
      dateTo?: string;
      amountMin?: number;
      amountMax?: number;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const userAccounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    const where: any = {
      accountId: filters.accountId
        ? (accountIds.includes(filters.accountId) ? filters.accountId : undefined)
        : { in: accountIds },
    };

    if (!where.accountId) {
      throw new AppError('Account not found', 404, ErrorCodes.ACCT_001);
    }

    const validTypes = Object.values(TransactionType) as string[];
    const validCategories = Object.values(TransactionCategory) as string[];
    const validStatuses = Object.values(TransactionStatus) as string[];

    if (filters.type && validTypes.includes(filters.type)) where.type = filters.type;
    if (filters.category && validCategories.includes(filters.category)) where.category = filters.category;
    if (filters.status && validStatuses.includes(filters.status)) where.status = filters.status;

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
      where.amount = {};
      if (filters.amountMin !== undefined) where.amount.gte = filters.amountMin;
      if (filters.amountMax !== undefined) where.amount.lte = filters.amountMax;
    }

    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { merchantName: { contains: filters.search, mode: 'insensitive' } },
        { reference: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const { skip, take, page, limit } = getPagination({ page: filters.page, limit: filters.limit });

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, meta: buildPaginationMeta(total, page, limit) };
  }

  async getTransaction(id: string, userId: string) {
    const userAccounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
    const accountIds = userAccounts.map((a) => a.id);

    const transaction = await prisma.transaction.findFirst({
      where: { id, accountId: { in: accountIds } },
      include: { fromTransfer: true, toTransfer: true },
    });

    if (!transaction) throw new AppError('Transaction not found', 404, ErrorCodes.NOT_FOUND);
    return transaction;
  }

  async getSummary(userId: string, accountId?: string, dateFrom?: string, dateTo?: string) {
    const userAccounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
    const accountIds = userAccounts.map((a) => a.id);

    const where: any = {
      accountId: accountId
        ? (accountIds.includes(accountId) ? accountId : undefined)
        : { in: accountIds },
      status: 'COMPLETED',
    };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [byType, byCategory] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.groupBy({
        by: ['category'],
        where: { ...where, type: 'DEBIT' },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
    ]);

    const totalIn = byType.find((t) => t.type === 'CREDIT')?._sum.amount ?? 0;
    const totalOut = byType.find((t) => t.type === 'DEBIT')?._sum.amount ?? 0;

    return { totalIn, totalOut, net: Number(totalIn) - Number(totalOut), byCategory };
  }

  async exportCsv(userId: string, accountId?: string, dateFrom?: string, dateTo?: string): Promise<string> {
    const result = await this.getTransactions(userId, {
      accountId,
      dateFrom,
      dateTo,
      limit: 10000,
    });

    const headers = ['Date', 'Reference', 'Description', 'Type', 'Category', 'Amount', 'Currency', 'Balance After', 'Status'];
    const rows = result.transactions.map((t) => [
      t.createdAt.toISOString(),
      t.reference,
      `"${t.description.replace(/"/g, '""')}"`,
      t.type,
      t.category,
      t.amount.toString(),
      t.currency,
      t.balanceAfter.toString(),
      t.status,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

export const transactionsService = new TransactionsService();
