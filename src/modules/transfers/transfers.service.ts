import { Decimal } from '@prisma/client/runtime/library';
import { TransferType, TransferStatus, TransactionType, TransactionCategory, AccountStatus, Account, User, UserTier } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { generateTransactionReference } from '../../shared/utils/transaction-ref';
import { getPagination, buildPaginationMeta } from '../../shared/utils/pagination';
import { getBankByCode } from '../../shared/constants/banks';
import { ratesService } from '../rates/rates.service';
import { mailService } from '../../shared/services/mail.service';

const DAILY_LIMITS: Record<UserTier, number> = {
  STANDARD: 5_000,
  PREMIUM: 25_000,
  PRIVATE: 100_000,
  BUSINESS: 100_000,
};

const DAILY_TX_COUNT_LIMITS: Record<UserTier, number> = {
  STANDARD: 10,
  PREMIUM: 30,
  PRIVATE: 100,
  BUSINESS: 100,
};

const ALERT_THRESHOLD = 1_000;

export class TransfersService {
  // Own-accounts internal transfer (same user)
  async internal(
    userId: string,
    data: { fromAccountId: string; toAccountId: string; amount: number; description: string }
  ) {
    if (data.fromAccountId === data.toAccountId) {
      throw new AppError('Cannot transfer to the same account', 400, ErrorCodes.TRNF_003);
    }

    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({ where: { id: data.fromAccountId, userId } }),
      prisma.account.findFirst({ where: { id: data.toAccountId, userId } }),
    ]);

    if (!fromAccount) throw new AppError('Source account not found', 404, ErrorCodes.ACCT_001);
    if (!toAccount) throw new AppError('Destination account not found', 404, ErrorCodes.ACCT_001);
    if (fromAccount.status === AccountStatus.FROZEN) throw new AppError('Source account is frozen', 400, ErrorCodes.ACCT_002);
    if (toAccount.status === AccountStatus.FROZEN) throw new AppError('Destination account is frozen', 400, ErrorCodes.ACCT_002);

    await this.checkDailyTxCount(userId);

    const amount = new Decimal(data.amount);
    if (fromAccount.availableBalance.lessThan(amount)) {
      throw new AppError('Insufficient funds', 400, ErrorCodes.ACCT_003);
    }

    const transfer = await prisma.$transaction(async (tx) => {
      const fromBefore = fromAccount.balance;
      const fromAfter = fromAccount.balance.minus(amount);
      const toBefore = toAccount.balance;
      const toAfter = toAccount.balance.plus(amount);

      await tx.account.update({ where: { id: fromAccount.id }, data: { balance: fromAfter, availableBalance: fromAccount.availableBalance.minus(amount) } });
      await tx.account.update({ where: { id: toAccount.id }, data: { balance: toAfter, availableBalance: toAccount.availableBalance.plus(amount) } });

      const fromTx = await tx.transaction.create({
        data: {
          reference: generateTransactionReference(),
          accountId: fromAccount.id,
          type: TransactionType.DEBIT,
          category: TransactionCategory.TRANSFER,
          amount,
          currency: fromAccount.currency,
          balanceBefore: fromBefore,
          balanceAfter: fromAfter,
          description: data.description,
          counterpartyName: `${toAccount.type} Account`,
          counterpartyAccountNumber: toAccount.accountNumber,
          status: 'COMPLETED',
          valueDate: new Date(),
        },
      });

      const toTx = await tx.transaction.create({
        data: {
          reference: generateTransactionReference(),
          accountId: toAccount.id,
          type: TransactionType.CREDIT,
          category: TransactionCategory.TRANSFER,
          amount,
          currency: toAccount.currency,
          balanceBefore: toBefore,
          balanceAfter: toAfter,
          description: data.description,
          counterpartyName: `${fromAccount.type} Account`,
          counterpartyAccountNumber: fromAccount.accountNumber,
          status: 'COMPLETED',
          valueDate: new Date(),
        },
      });

      return tx.transfer.create({
        data: {
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          fromTransactionId: fromTx.id,
          toTransactionId: toTx.id,
          amount,
          currency: fromAccount.currency,
          description: data.description,
          status: TransferStatus.COMPLETED,
          type: TransferType.INTERNAL,
          executedAt: new Date(),
        },
      });
    });

    await this.notify(userId, 'Transfer sent', `£${data.amount.toFixed(2)} moved to your ${toAccount.type} account`);
    return transfer;
  }

  // Lumina-to-Lumina cross-user transfer (instant, no fee)
  private async luminaToLumina(
    fromAccount: Account & { user: Pick<User, 'id' | 'firstName' | 'lastName'> },
    toAccount: Account & { user: Pick<User, 'id' | 'firstName' | 'lastName'> },
    amount: number,
    description: string,
    fromUserId: string
  ) {
    if (fromAccount.id === toAccount.id) {
      throw new AppError('Cannot transfer to the same account', 400, ErrorCodes.TRNF_003);
    }
    if (toAccount.status === AccountStatus.FROZEN) {
      throw new AppError('Destination account is frozen', 400, ErrorCodes.ACCT_002);
    }
    const transferAmount = new Decimal(amount);
    if (fromAccount.availableBalance.lessThan(transferAmount)) {
      throw new AppError('Insufficient funds', 400, ErrorCodes.ACCT_003);
    }

    const transfer = await prisma.$transaction(async (tx) => {
      const fromBefore = fromAccount.balance;
      const fromAfter = fromAccount.balance.minus(transferAmount);
      const toBefore = toAccount.balance;
      const toAfter = toAccount.balance.plus(transferAmount);

      await tx.account.update({ where: { id: fromAccount.id }, data: { balance: fromAfter, availableBalance: fromAccount.availableBalance.minus(transferAmount) } });
      await tx.account.update({ where: { id: toAccount.id }, data: { balance: toAfter, availableBalance: toAccount.availableBalance.plus(transferAmount) } });

      const fromTx = await tx.transaction.create({
        data: {
          reference: generateTransactionReference(),
          accountId: fromAccount.id,
          type: TransactionType.DEBIT,
          category: TransactionCategory.TRANSFER,
          amount: transferAmount,
          currency: fromAccount.currency,
          balanceBefore: fromBefore,
          balanceAfter: fromAfter,
          description,
          counterpartyName: `${toAccount.user.firstName} ${toAccount.user.lastName}`,
          counterpartyAccountNumber: toAccount.accountNumber,
          status: 'COMPLETED',
          valueDate: new Date(),
        },
      });

      const toTx = await tx.transaction.create({
        data: {
          reference: generateTransactionReference(),
          accountId: toAccount.id,
          type: TransactionType.CREDIT,
          category: TransactionCategory.TRANSFER,
          amount: transferAmount,
          currency: toAccount.currency,
          balanceBefore: toBefore,
          balanceAfter: toAfter,
          description,
          counterpartyName: `${fromAccount.user.firstName} ${fromAccount.user.lastName}`,
          counterpartyAccountNumber: fromAccount.accountNumber,
          status: 'COMPLETED',
          valueDate: new Date(),
        },
      });

      return tx.transfer.create({
        data: {
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          fromTransactionId: fromTx.id,
          toTransactionId: toTx.id,
          amount: transferAmount,
          currency: fromAccount.currency,
          description,
          status: TransferStatus.COMPLETED,
          type: TransferType.INTERNAL,
          executedAt: new Date(),
        },
      });
    });

    await this.notify(fromUserId, 'Transfer sent', `£${amount.toFixed(2)} sent to ${toAccount.user.firstName} ${toAccount.user.lastName}`);
    await this.notify(toAccount.userId, 'Money received', `£${amount.toFixed(2)} received from Lumina Bank transfer — ${description}`);
    return transfer;
  }

  async domestic(
    userId: string,
    data: {
      fromAccountId: string;
      toAccountNumber: string;
      toBankCode: string;
      toAccountName: string;
      amount: number;
      description: string;
      saveBeneficiary?: boolean;
    }
  ) {
    const fromAccount = await prisma.account.findFirst({
      where: { id: data.fromAccountId, userId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!fromAccount) throw new AppError('Source account not found', 404, ErrorCodes.ACCT_001);
    if (fromAccount.status === AccountStatus.FROZEN) throw new AppError('Source account is frozen', 400, ErrorCodes.ACCT_002);

    await this.checkDailyTxCount(userId);
    await this.checkDailyLimit(userId, data.amount);

    // Detect Lumina-to-Lumina
    const luminaAccount = await prisma.account.findFirst({
      where: { accountNumber: data.toAccountNumber },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (luminaAccount) {
      return this.luminaToLumina(fromAccount as any, luminaAccount as any, data.amount, data.description, userId);
    }

    const bank = getBankByCode(data.toBankCode);
    if (!bank) throw new AppError('Invalid bank code', 400, ErrorCodes.TRNF_002);

    const amount = new Decimal(data.amount);
    const fee = new Decimal(1.50);
    const total = amount.plus(fee);

    if (fromAccount.availableBalance.lessThan(total)) {
      throw new AppError('Insufficient funds (including £1.50 transfer fee)', 400, ErrorCodes.ACCT_003);
    }

    const balanceAfter = fromAccount.balance.minus(total);

    const transfer = await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: fromAccount.id },
        data: { balance: balanceAfter, availableBalance: fromAccount.availableBalance.minus(total) },
      });

      const fromTx = await tx.transaction.create({
        data: {
          reference: generateTransactionReference(),
          accountId: fromAccount.id,
          type: TransactionType.DEBIT,
          category: TransactionCategory.TRANSFER,
          amount,
          currency: fromAccount.currency,
          balanceBefore: fromAccount.balance,
          balanceAfter,
          description: data.description,
          counterpartyName: data.toAccountName,
          counterpartyAccountNumber: data.toAccountNumber,
          counterpartyBank: bank.name,
          status: 'PENDING',
          metadata: { fee: fee.toString(), bankCode: data.toBankCode },
          valueDate: new Date(),
        },
      });

      await tx.transaction.create({
        data: {
          reference: generateTransactionReference(),
          accountId: fromAccount.id,
          type: TransactionType.DEBIT,
          category: TransactionCategory.FEE,
          amount: fee,
          currency: fromAccount.currency,
          balanceBefore: balanceAfter.plus(fee),
          balanceAfter,
          description: 'Domestic transfer fee',
          status: 'COMPLETED',
          valueDate: new Date(),
        },
      });

      return tx.transfer.create({
        data: {
          fromAccountId: fromAccount.id,
          toAccountNumber: data.toAccountNumber,
          toBank: bank.name,
          toBankCode: data.toBankCode,
          fromTransactionId: fromTx.id,
          amount,
          currency: fromAccount.currency,
          transferFee: fee,
          description: data.description,
          status: TransferStatus.PENDING,
          type: TransferType.DOMESTIC,
        },
      });
    });

    if (data.saveBeneficiary) {
      await prisma.beneficiary.create({
        data: {
          userId,
          nickname: data.toAccountName,
          accountName: data.toAccountName,
          accountNumber: data.toAccountNumber,
          bankName: bank.name,
          bankCode: data.toBankCode,
          currency: fromAccount.currency,
        },
      }).catch(() => {});
    }

    await this.notify(userId, 'Transfer submitted', `£${data.amount.toFixed(2)} to ${data.toAccountName} is being processed (1–2 business days)`);
    await this.alertIfLarge(userId, data.amount, fromAccount.currency, data.toAccountName, transfer.id);
    return transfer;
  }

  async international(
    userId: string,
    data: {
      fromAccountId: string;
      toIban: string;
      swiftCode: string;
      toBankName: string;
      toAccountName: string;
      toCountry: string;
      toCurrency: string;
      amount: number;
      description: string;
    }
  ) {
    const fromAccount = await prisma.account.findFirst({ where: { id: data.fromAccountId, userId } });
    if (!fromAccount) throw new AppError('Source account not found', 404, ErrorCodes.ACCT_001);
    if (fromAccount.status === AccountStatus.FROZEN) throw new AppError('Source account is frozen', 400, ErrorCodes.ACCT_002);

    await this.checkDailyTxCount(userId);
    await this.checkDailyLimit(userId, data.amount);

    const quote = await ratesService.getQuote(fromAccount.currency, data.toCurrency, data.amount);
    const amount = new Decimal(data.amount);
    const fxFee = new Decimal(quote.fxFee);
    const transferFee = new Decimal(5);
    const total = amount.plus(fxFee).plus(transferFee);

    if (fromAccount.availableBalance.lessThan(total)) {
      throw new AppError('Insufficient funds (including FX fee and £5.00 transfer fee)', 400, ErrorCodes.ACCT_003);
    }

    const balanceAfter = fromAccount.balance.minus(total);

    const transfer = await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: fromAccount.id },
        data: { balance: balanceAfter, availableBalance: fromAccount.availableBalance.minus(total) },
      });

      const fromTx = await tx.transaction.create({
        data: {
          reference: generateTransactionReference(),
          accountId: fromAccount.id,
          type: TransactionType.DEBIT,
          category: TransactionCategory.FX,
          amount,
          currency: fromAccount.currency,
          balanceBefore: fromAccount.balance,
          balanceAfter,
          description: data.description,
          counterpartyName: data.toAccountName,
          counterpartyBank: data.toBankName,
          status: 'PENDING',
          metadata: {
            fxRate: quote.customerRate,
            convertedAmount: quote.convertedAmount,
            toCurrency: data.toCurrency,
            toCountry: data.toCountry,
            fxFee: fxFee.toString(),
            transferFee: transferFee.toString(),
            swiftCode: data.swiftCode,
            toIban: data.toIban,
          },
          valueDate: new Date(),
        },
      });

      return tx.transfer.create({
        data: {
          fromAccountId: fromAccount.id,
          toAccountNumber: data.toIban,
          toBank: data.toBankName,
          fromTransactionId: fromTx.id,
          amount,
          currency: fromAccount.currency,
          fxRate: new Decimal(quote.customerRate),
          fxFee,
          transferFee,
          description: data.description,
          status: TransferStatus.PENDING,
          type: TransferType.INTERNATIONAL,
        },
      });
    });

    await this.notify(userId, 'International transfer submitted', `£${data.amount.toFixed(2)} to ${data.toAccountName} is being processed (3–5 business days)`);
    await this.alertIfLarge(userId, data.amount, fromAccount.currency, data.toAccountName, transfer.id);
    return { transfer, quote };
  }

  async schedule(
    userId: string,
    data: { fromAccountId: string; toAccountNumber: string; toBankCode: string; toAccountName: string; amount: number; description: string; scheduledAt: string }
  ) {
    const fromAccount = await prisma.account.findFirst({ where: { id: data.fromAccountId, userId } });
    if (!fromAccount) throw new AppError('Source account not found', 404, ErrorCodes.ACCT_001);

    const scheduledAt = new Date(data.scheduledAt);
    if (scheduledAt <= new Date()) throw new AppError('Scheduled date must be in the future', 400, ErrorCodes.TRNF_005);

    const bank = getBankByCode(data.toBankCode);
    if (!bank) throw new AppError('Invalid bank code', 400, ErrorCodes.TRNF_002);

    return prisma.transfer.create({
      data: {
        fromAccountId: fromAccount.id,
        toAccountNumber: data.toAccountNumber,
        toBank: bank.name,
        toBankCode: data.toBankCode,
        amount: new Decimal(data.amount),
        currency: fromAccount.currency,
        description: data.description,
        scheduledAt,
        status: TransferStatus.PENDING,
        type: TransferType.SCHEDULED,
      },
    });
  }

  async getScheduled(userId: string) {
    const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
    const accountIds = accounts.map((a) => a.id);
    return prisma.transfer.findMany({
      where: { fromAccountId: { in: accountIds }, type: TransferType.SCHEDULED, status: TransferStatus.PENDING, scheduledAt: { gt: new Date() } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async cancelScheduled(id: string, userId: string) {
    const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
    const accountIds = accounts.map((a) => a.id);
    const transfer = await prisma.transfer.findFirst({
      where: { id, fromAccountId: { in: accountIds }, type: TransferType.SCHEDULED, status: TransferStatus.PENDING },
    });
    if (!transfer) throw new AppError('Transfer not found or cannot be cancelled', 404, ErrorCodes.NOT_FOUND);
    return prisma.transfer.update({ where: { id }, data: { status: TransferStatus.CANCELLED } });
  }

  async getTransfers(userId: string, filters: { page?: number; limit?: number; type?: TransferType; status?: TransferStatus }) {
    const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
    const accountIds = accounts.map((a) => a.id);
    const { skip, take, page, limit } = getPagination({ page: filters.page, limit: filters.limit });
    const where: any = { fromAccountId: { in: accountIds } };
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.transfer.count({ where }),
    ]);
    return { transfers, meta: buildPaginationMeta(total, page, limit) };
  }

  async getTransfer(id: string, userId: string) {
    const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
    const accountIds = accounts.map((a) => a.id);
    const transfer = await prisma.transfer.findFirst({ where: { id, fromAccountId: { in: accountIds } } });
    if (!transfer) throw new AppError('Transfer not found', 404, ErrorCodes.NOT_FOUND);
    return transfer;
  }

  async getFxQuote(fromCurrency: string, toCurrency: string, amount: number) {
    return ratesService.getQuote(fromCurrency, toCurrency, amount);
  }

  private async notify(userId: string, title: string, body: string) {
    await prisma.notification.create({ data: { userId, type: 'TRANSFER', title, body } }).catch(() => {});
  }

  private async checkDailyLimit(userId: string, amountGbp: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);

    const limit = DAILY_LIMITS[user.tier];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
    const accountIds = accounts.map((a) => a.id);

    const result = await prisma.transfer.aggregate({
      where: {
        fromAccountId: { in: accountIds },
        type: { in: [TransferType.DOMESTIC, TransferType.INTERNATIONAL] },
        status: { in: [TransferStatus.PENDING, TransferStatus.COMPLETED] },
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });

    const spent = Number(result._sum.amount ?? 0);
    if (spent + amountGbp > limit) {
      throw new AppError(
        `Daily transfer limit of £${limit.toLocaleString()} exceeded. You have £${(limit - spent).toFixed(2)} remaining today.`,
        400,
        ErrorCodes.TRNF_004
      );
    }
  }

  private async checkDailyTxCount(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);

    const limit = DAILY_TX_COUNT_LIMITS[user.tier];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } });
    const accountIds = accounts.map((a) => a.id);

    const count = await prisma.transfer.count({
      where: {
        fromAccountId: { in: accountIds },
        status: { notIn: [TransferStatus.CANCELLED, TransferStatus.FAILED] },
        createdAt: { gte: since },
      },
    });

    if (count >= limit) {
      throw new AppError(
        `Daily transaction limit of ${limit} reached. You can make more transfers tomorrow.`,
        429,
        ErrorCodes.TRNF_006
      );
    }
  }

  private async alertIfLarge(userId: string, amount: number, currency: string, recipient: string, reference: string) {
    if (amount < ALERT_THRESHOLD) return;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) return;
    mailService
      .sendTransferNotification(user.email, {
        amount: amount.toFixed(2),
        currency,
        recipient,
        reference,
      })
      .catch(() => {});
  }
}

export const transfersService = new TransfersService();
