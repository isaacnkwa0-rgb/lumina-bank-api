import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { KycStatus, UserStatus, NotificationType, Prisma, TransferStatus, TransactionType, TransactionCategory, LoanStatus, LoanPaymentStatus, DisputeStatus, InsuranceStatus, CardStatus, LoanType, GoalStatus } from '@prisma/client';
import { mailService } from '../../shared/services/mail.service';
import { Decimal } from '@prisma/client/runtime/library';
import { getPagination, buildPaginationMeta } from '../../shared/utils/pagination';
import { ErrorCodes } from '../../shared/utils/api-response';
import { generateTransactionReference } from '../../shared/utils/transaction-ref';
import { ratesService } from '../rates/rates.service';

interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

interface AuditFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
}

export class AdminService {
  async getUsers(filters: UserFilters) {
    const { page = 1, limit = 20, search, status } = filters;
    const { skip, take } = getPagination({ page, limit });

    const where: Prisma.UserWhereInput = {
      ...(status ? { status: status as UserStatus } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          tier: true,
          kycStatus: true,
          createdAt: true,
          _count: { select: { accounts: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, meta: buildPaginationMeta(total, page, limit) };
  }

  async getUser(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        accounts: {
          select: { id: true, accountNumber: true, type: true, balance: true, currency: true, isDefault: true },
        },
        profile: true,
        _count: { select: { accounts: true, loans: true, disputes: true } },
      },
    });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    const { passwordHash: _pw, twoFactorSecret: _2fa, ...safeUser } = user;
    return safeUser;
  }

  async suspendUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    if (user.status === UserStatus.SUSPENDED) throw new AppError('User is already suspended', 400, ErrorCodes.CONFLICT);
    return prisma.user.update({ where: { id }, data: { status: UserStatus.SUSPENDED }, select: { id: true, email: true, status: true } });
  }

  async activateUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    return prisma.user.update({ where: { id }, data: { status: UserStatus.ACTIVE }, select: { id: true, email: true, status: true } });
  }

  async approveKyc(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    if (user.kycStatus !== KycStatus.PENDING) throw new AppError('KYC is not pending', 400, ErrorCodes.CONFLICT);

    await prisma.user.update({ where: { id: userId }, data: { kycStatus: KycStatus.VERIFIED } });
    await prisma.notification.create({
      data: { userId, type: NotificationType.SYSTEM, title: 'KYC Approved', body: 'Your identity has been verified. You now have full access.' },
    });
    mailService.sendKycStatusUpdate(user.email, 'VERIFIED').catch(() => {});
    return { userId, kycStatus: KycStatus.VERIFIED };
  }

  async rejectKyc(userId: string, reason: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    if (user.kycStatus !== KycStatus.PENDING) throw new AppError('KYC is not pending', 400, ErrorCodes.CONFLICT);

    await prisma.user.update({ where: { id: userId }, data: { kycStatus: KycStatus.REJECTED } });
    await prisma.notification.create({
      data: { userId, type: NotificationType.SYSTEM, title: 'KYC Rejected', body: `Verification rejected. Reason: ${reason}. Please resubmit.` },
    });
    mailService.sendKycStatusUpdate(user.email, 'REJECTED', reason).catch(() => {});
    return { userId, kycStatus: KycStatus.REJECTED, reason };
  }

  async getAuditLogs(filters: AuditFilters) {
    const { page = 1, limit = 20, userId, action } = filters;
    const { skip, take } = getPagination({ page, limit });

    const where: Prisma.AuditLogWhereInput = {
      ...(userId ? { userId } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, meta: buildPaginationMeta(total, page, limit) };
  }

  async getStats() {
    const [totalUsers, activeUsers, totalAccounts, transactionStats, totalTransfers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      prisma.account.count(),
      prisma.transaction.aggregate({ _count: { id: true }, _sum: { amount: true } }),
      prisma.transfer.count(),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalAccounts,
      totalTransactions: transactionStats._count.id,
      totalTransactionVolume: transactionStats._sum.amount?.toNumber() ?? 0,
      totalTransfers,
    };
  }

  async getTransfers(filters: { page?: number; limit?: number; status?: string; type?: string }) {
    const { page = 1, limit = 20, status, type } = filters;
    const { skip, take } = getPagination({ page, limit });

    const where: Prisma.TransferWhereInput = {};
    if (status) where.status = status as TransferStatus;
    if (type) where.type = type as any;

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        skip,
        take,
        include: {
          fromAccount: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transfer.count({ where }),
    ]);

    return { transfers, meta: buildPaginationMeta(total, page, limit) };
  }

  async approveTransfer(id: string) {
    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: { fromAccount: { include: { user: { select: { id: true } } } } },
    });
    if (!transfer) throw new AppError('Transfer not found', 404, ErrorCodes.NOT_FOUND);
    if (transfer.status !== TransferStatus.PENDING) throw new AppError('Transfer is not pending', 400, ErrorCodes.CONFLICT);

    await prisma.$transaction(async (tx) => {
      await tx.transfer.update({ where: { id }, data: { status: TransferStatus.COMPLETED, executedAt: new Date() } });
      if (transfer.fromTransactionId) {
        await tx.transaction.update({ where: { id: transfer.fromTransactionId }, data: { status: 'COMPLETED' } });
      }
    });

    const userId = transfer.fromAccount.user.id;
    const amount = Number(transfer.amount).toFixed(2);
    await prisma.notification.create({
      data: {
        userId,
        type: 'TRANSFER',
        title: 'Transfer approved',
        body: `Your transfer of £${amount} has been processed and sent successfully.`,
      },
    });

    return prisma.transfer.findUnique({ where: { id } });
  }

  async rejectTransfer(id: string, reason?: string) {
    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: { fromAccount: { include: { user: { select: { id: true } } } } },
    });
    if (!transfer) throw new AppError('Transfer not found', 404, ErrorCodes.NOT_FOUND);
    if (transfer.status !== TransferStatus.PENDING) throw new AppError('Transfer is not pending', 400, ErrorCodes.CONFLICT);

    const transferFee = transfer.transferFee ?? new Decimal(0);
    const fxFee = transfer.fxFee ?? new Decimal(0);
    const refundAmount = transfer.amount.plus(transferFee).plus(fxFee);

    await prisma.$transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { id: transfer.fromAccountId } });
      if (!account) return;

      await tx.account.update({
        where: { id: transfer.fromAccountId },
        data: {
          balance: account.balance.plus(refundAmount),
          availableBalance: account.availableBalance.plus(refundAmount),
        },
      });

      await tx.transaction.create({
        data: {
          reference: generateTransactionReference(),
          accountId: transfer.fromAccountId,
          type: TransactionType.CREDIT,
          category: TransactionCategory.REFUND,
          amount: refundAmount,
          currency: transfer.currency,
          balanceBefore: account.balance,
          balanceAfter: account.balance.plus(refundAmount),
          description: `Transfer reversed: ${reason || 'Rejected by bank'}`,
          status: 'COMPLETED',
          valueDate: new Date(),
        },
      });

      if (transfer.fromTransactionId) {
        await tx.transaction.update({ where: { id: transfer.fromTransactionId }, data: { status: 'FAILED' } });
      }

      await tx.transfer.update({ where: { id }, data: { status: TransferStatus.FAILED } });
    });

    const userId = transfer.fromAccount.user.id;
    const amount = Number(transfer.amount).toFixed(2);
    await prisma.notification.create({
      data: {
        userId,
        type: 'TRANSFER',
        title: 'Transfer rejected',
        body: `Your transfer of £${amount} was rejected${reason ? ': ' + reason : ''}. Funds have been returned to your account.`,
      },
    });

    return prisma.transfer.findUnique({ where: { id } });
  }

  // ── Loans ────────────────────────────────────────────────────────────────────

  async getLoans(status?: string) {
    const where = status ? { status: status as LoanStatus } : {};
    return prisma.loan.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveLoan(id: string) {
    const loan = await prisma.loan.findUnique({ where: { id }, include: { user: true } });
    if (!loan) throw new AppError('Loan not found', 404, ErrorCodes.NOT_FOUND);
    if (loan.status !== LoanStatus.PENDING) throw new AppError('Loan is not pending', 400, ErrorCodes.CONFLICT);

    const annualRate = loan.interestRate.toNumber();
    const r = annualRate / 12;
    const n = loan.termMonths;
    const monthly = loan.monthlyPayment.toNumber();
    let balance = loan.principalAmount.toNumber();
    const payments = [];
    for (let i = 1; i <= n; i++) {
      const interest = Math.round(balance * r * 100) / 100;
      const principal = Math.round((monthly - interest) * 100) / 100;
      balance = Math.round((balance - principal) * 100) / 100;
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      payments.push({ loanId: id, amount: monthly, principalPortion: principal, interestPortion: interest, paymentDate: date, status: LoanPaymentStatus.SCHEDULED });
    }

    await prisma.$transaction([
      prisma.loan.update({ where: { id }, data: { status: LoanStatus.ACTIVE, disbursedAt: new Date() } }),
      prisma.loanPayment.createMany({ data: payments }),
      prisma.notification.create({ data: { userId: loan.userId, type: NotificationType.LOAN as any, title: 'Loan Approved', body: `Your ${loan.type.toLowerCase()} loan of £${Number(loan.principalAmount).toLocaleString()} has been approved and will be disbursed shortly.` } }),
    ]);

    return prisma.loan.findUnique({ where: { id } });
  }

  async rejectLoan(id: string, reason?: string) {
    const loan = await prisma.loan.findUnique({ where: { id }, include: { user: true } });
    if (!loan) throw new AppError('Loan not found', 404, ErrorCodes.NOT_FOUND);
    if (loan.status !== LoanStatus.PENDING) throw new AppError('Loan is not pending', 400, ErrorCodes.CONFLICT);

    await prisma.$transaction([
      prisma.loan.update({ where: { id }, data: { status: LoanStatus.REJECTED } }),
      prisma.notification.create({ data: { userId: loan.userId, type: NotificationType.LOAN as any, title: 'Loan Application Rejected', body: `Your loan application was not approved${reason ? ': ' + reason : ''}. Please contact support for more information.` } }),
    ]);

    return { id, status: LoanStatus.REJECTED, reason };
  }

  // ── Disputes ─────────────────────────────────────────────────────────────────

  async getDisputes(status?: string) {
    const where = status ? { status: status as DisputeStatus } : {};
    return prisma.dispute.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveDispute(id: string, resolution: string) {
    const dispute = await prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new AppError('Dispute not found', 404, ErrorCodes.NOT_FOUND);

    await prisma.dispute.update({ where: { id }, data: { status: DisputeStatus.RESOLVED, resolution, resolvedAt: new Date() } });
    await prisma.notification.create({
      data: { userId: dispute.userId, type: NotificationType.SYSTEM, title: 'Dispute Resolved', body: `Your dispute has been resolved. ${resolution}` },
    });

    return { id, status: DisputeStatus.RESOLVED, resolution };
  }

  // ── Insurance ────────────────────────────────────────────────────────────────

  async getInsuranceQuotes(status?: string) {
    const where = status ? { status: status as InsuranceStatus } : {};
    return prisma.insuranceQuote.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async processInsuranceQuote(id: string, status: string, premium?: number, notes?: string) {
    const quote = await prisma.insuranceQuote.findUnique({ where: { id } });
    if (!quote) throw new AppError('Insurance quote not found', 404, ErrorCodes.NOT_FOUND);

    const data: Prisma.InsuranceQuoteUpdateInput = { status: status as InsuranceStatus };
    if (premium !== undefined) data.premium = premium;
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.insuranceQuote.update({ where: { id }, data });

    const title = status === 'ACCEPTED' ? 'Insurance Quote Accepted'
      : status === 'DECLINED' ? 'Insurance Quote Declined'
      : 'Insurance Quote Updated';
    const body = status === 'ACCEPTED'
      ? `Your ${quote.type.toLowerCase()} insurance quote has been accepted at £${Number(premium ?? quote.premium).toFixed(2)}/month.`
      : status === 'DECLINED'
      ? `Your ${quote.type.toLowerCase()} insurance quote could not be processed at this time.`
      : `Your insurance quote status has been updated.`;

    await prisma.notification.create({ data: { userId: quote.userId, type: NotificationType.SYSTEM, title, body } });
    return updated;
  }

  // ── Cards ────────────────────────────────────────────────────────────────────

  async getAdminCards(filters: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = filters;
    const { skip, take } = getPagination({ page, limit });
    const where: Prisma.CardWhereInput = status ? { status: status as CardStatus } : {};

    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where, skip, take,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          account: { select: { accountNumber: true, type: true, currency: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.card.count({ where }),
    ]);

    return { cards, meta: buildPaginationMeta(total, page, limit) };
  }

  async blockCard(id: string) {
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) throw new AppError('Card not found', 404, ErrorCodes.NOT_FOUND);
    if (card.status === CardStatus.BLOCKED) throw new AppError('Card is already blocked', 400, ErrorCodes.CONFLICT);
    const updated = await prisma.card.update({ where: { id }, data: { status: CardStatus.BLOCKED } });
    await prisma.notification.create({ data: { userId: card.userId, type: NotificationType.SYSTEM, title: 'Card Blocked', body: `Your card ending ${card.maskedPan.slice(-4)} has been blocked. Please contact support if this was unexpected.` } });
    return updated;
  }

  async unblockCard(id: string) {
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) throw new AppError('Card not found', 404, ErrorCodes.NOT_FOUND);
    if (card.status === CardStatus.CANCELLED || card.status === CardStatus.EXPIRED) {
      throw new AppError('Cannot unblock a cancelled or expired card', 400, ErrorCodes.CONFLICT);
    }
    const updated = await prisma.card.update({ where: { id }, data: { status: CardStatus.ACTIVE } });
    await prisma.notification.create({ data: { userId: card.userId, type: NotificationType.SYSTEM, title: 'Card Unblocked', body: `Your card ending ${card.maskedPan.slice(-4)} has been unblocked and is ready to use.` } });
    return updated;
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  async getAdminTransactions(filters: { page?: number; limit?: number; status?: string; type?: string }) {
    const { page = 1, limit = 30, status, type } = filters;
    const { skip, take } = getPagination({ page, limit });

    const where: Prisma.TransactionWhereInput = {};
    if (status) where.status = status as any;
    if (type) where.type = type as TransactionType;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where, skip, take,
        include: {
          account: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, meta: buildPaginationMeta(total, page, limit) };
  }

  // ── Exchange Rates ───────────────────────────────────────────────────────────

  async getAdminRates() {
    return prisma.exchangeRate.findMany({ orderBy: { quoteCurrency: 'asc' } });
  }

  async refreshAdminRates() {
    await ratesService.refreshRates();
    return prisma.exchangeRate.findMany({ orderBy: { quoteCurrency: 'asc' } });
  }

  // ── Investments ──────────────────────────────────────────────────────────────

  async getAdminInvestments() {
    return prisma.portfolio.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        investments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Savings Goals ─────────────────────────────────────────────────────────────

  async getAdminGoals(status?: string) {
    const where: Prisma.SavingsGoalWhereInput = status ? { status: status as GoalStatus } : {};
    return prisma.savingsGoal.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Loans with type filter ───────────────────────────────────────────────────

  async getLoansByType(status?: string, type?: string) {
    const where: Prisma.LoanWhereInput = {};
    if (status) where.status = status as LoanStatus;
    if (type) where.type = type as LoanType;
    return prisma.loan.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const adminService = new AdminService();
