import { AccountType, AccountStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { generateAccountNumber, generateIBAN } from '../../shared/utils/account-number';
import { getPagination, buildPaginationMeta } from '../../shared/utils/pagination';

export class AccountsService {
  async getAccounts(userId: string) {
    return prisma.account.findMany({
      where: { userId, status: { not: AccountStatus.CLOSED } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getAccount(id: string, userId: string) {
    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) throw new AppError('Account not found', 404, ErrorCodes.ACCT_001);
    return account;
  }

  async createAccount(
    userId: string,
    data: { type: AccountType; currency?: string; interestRate?: number; maturityDate?: string }
  ) {
    const existing = await prisma.account.findFirst({
      where: { userId, type: data.type, status: { not: AccountStatus.CLOSED } },
    });
    if (existing)
      throw new AppError(
        `You already have an active ${data.type.toLowerCase().replace('_', ' ')} account`,
        409,
        ErrorCodes.ACCT_004
      );

    const accountNumber = generateAccountNumber();
    const iban = generateIBAN(data.currency ?? 'USD');

    return prisma.account.create({
      data: {
        userId,
        accountNumber,
        iban,
        type: data.type,
        currency: data.currency ?? 'USD',
        interestRate: data.interestRate,
        maturityDate: data.maturityDate ? new Date(data.maturityDate) : undefined,
      },
    });
  }

  async setDefault(id: string, userId: string) {
    await this.getAccount(id, userId);
    await prisma.account.updateMany({ where: { userId }, data: { isDefault: false } });
    return prisma.account.update({ where: { id }, data: { isDefault: true } });
  }

  async freeze(id: string, userId: string) {
    const account = await this.getAccount(id, userId);
    if (account.status === AccountStatus.FROZEN)
      throw new AppError('Account is already frozen', 400, ErrorCodes.ACCT_002);
    return prisma.account.update({ where: { id }, data: { status: AccountStatus.FROZEN } });
  }

  async unfreeze(id: string, userId: string) {
    const account = await this.getAccount(id, userId);
    if (account.status !== AccountStatus.FROZEN)
      throw new AppError('Account is not frozen', 400, ErrorCodes.ACCT_001);
    return prisma.account.update({ where: { id }, data: { status: AccountStatus.ACTIVE } });
  }

  async closeAccount(id: string, userId: string) {
    const account = await this.getAccount(id, userId);
    if (Number(account.balance) !== 0)
      throw new AppError('Account balance must be zero before closing', 400, ErrorCodes.ACCT_003);
    if (account.isDefault)
      throw new AppError('Cannot close the default account', 400, ErrorCodes.ACCT_001);
    return prisma.account.update({ where: { id }, data: { status: AccountStatus.CLOSED } });
  }

  async getBalance(id: string, userId: string) {
    const account = await this.getAccount(id, userId);
    return {
      balance: account.balance,
      availableBalance: account.availableBalance,
      currency: account.currency,
    };
  }

  async getStatement(id: string, userId: string, dateFrom?: string, dateTo?: string, page = 1, limit = 50) {
    await this.getAccount(id, userId);
    const { skip, take } = getPagination({ page, limit });

    const where: any = { accountId: id, status: 'COMPLETED' };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, meta: buildPaginationMeta(total, page, limit) };
  }
}

export const accountsService = new AccountsService();
