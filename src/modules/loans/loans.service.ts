import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { TransactionType, TransactionStatus, LoanStatus, LoanType, LoanPaymentStatus, TransactionCategory } from '@prisma/client';
import { generateTransactionReference } from '../../shared/utils/transaction-ref';

const LOAN_LIMITS: Record<string, number> = {
  PERSONAL: 50000,
  MORTGAGE: 500000,
  AUTO: 100000,
  STUDENT: 80000,
  BUSINESS: 250000,
};

const ANNUAL_RATES: Record<string, number> = {
  PERSONAL: 0.12,
  MORTGAGE: 0.065,
  AUTO: 0.08,
  STUDENT: 0.055,
  BUSINESS: 0.10,
};

function calcMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  const payment = (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
  return Math.round(payment * 100) / 100;
}

export class LoansService {
  async getLoans(userId: string) {
    return prisma.loan.findMany({
      where: { userId, status: { not: LoanStatus.REJECTED } },
      include: { payments: { take: 5, orderBy: { paymentDate: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLoan(id: string, userId: string) {
    const loan = await prisma.loan.findFirst({
      where: { id, userId },
      include: { payments: { orderBy: { paymentDate: 'asc' } } },
    });
    if (!loan) throw new AppError('Loan not found', 404);
    return loan;
  }

  async getAmortizationSchedule(id: string, userId: string) {
    const loan = await this.getLoan(id, userId);
    const principal = loan.principalAmount.toNumber();
    const annualRate = ANNUAL_RATES[loan.type] ?? 0.1;
    const r = annualRate / 12;
    const n = loan.termMonths;
    const monthlyPayment = calcMonthlyPayment(principal, annualRate, n);

    const schedule: {
      paymentNumber: number;
      dueDate: string;
      payment: number;
      principal: number;
      interest: number;
      balance: number;
    }[] = [];

    let balance = principal;
    const startDate = new Date(loan.createdAt);

    for (let i = 1; i <= n; i++) {
      const interestPayment = Math.round(balance * r * 100) / 100;
      const principalPayment = Math.round((monthlyPayment - interestPayment) * 100) / 100;
      balance = Math.round((balance - principalPayment) * 100) / 100;

      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + i);

      schedule.push({
        paymentNumber: i,
        dueDate: dueDate.toISOString().split('T')[0],
        payment: monthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, balance),
      });
    }

    return { loan: { id: loan.id, type: loan.type, amount: principal, termMonths: n }, schedule };
  }

  async applyForLoan(
    userId: string,
    data: { type: string; amount: number; termMonths: number },
  ) {
    const { type, amount, termMonths } = data;
    const limit = LOAN_LIMITS[type] ?? 10000;

    if (amount > limit) {
      throw new AppError(
        `Maximum loan amount for ${type} is $${limit.toLocaleString()}`,
        400,
      );
    }
    if (termMonths < 1 || termMonths > 360) {
      throw new AppError('Term must be between 1 and 360 months', 400);
    }

    const annualRate = ANNUAL_RATES[type] ?? 0.1;
    const monthlyPayment = calcMonthlyPayment(amount, annualRate, termMonths);

    const loan = await prisma.loan.create({
      data: {
        userId,
        type: type as LoanType,
        principalAmount: amount,
        termMonths,
        outstandingBalance: amount,
        monthlyPayment,
        interestRate: annualRate,
        status: LoanStatus.PENDING,
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'LOAN' as any,
        title: 'Loan Application Received',
        body: `Your ${type.toLowerCase()} loan application for £${amount.toLocaleString()} is under review. We'll notify you within 1–2 business days.`,
      },
    });

    return { ...loan, upcomingPayments: 0 };
  }

  async getPayments(id: string, userId: string) {
    const loan = await prisma.loan.findFirst({ where: { id, userId } });
    if (!loan) throw new AppError('Loan not found', 404);
    return prisma.loanPayment.findMany({
      where: { loanId: id },
      orderBy: { paymentDate: 'asc' },
    });
  }

  async repay(id: string, userId: string, amount: number) {
    const loan = await prisma.loan.findFirst({ where: { id, userId } });
    if (!loan) throw new AppError('Loan not found', 404);
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new AppError('Loan is not active', 400);
    }

    const defaultAccount = await prisma.account.findFirst({
      where: { userId, isDefault: true },
    });
    if (!defaultAccount) throw new AppError('No default account found', 404);
    if (defaultAccount.balance.toNumber() < amount) {
      throw new AppError('Insufficient funds', 400);
    }

    const newBalance = Math.max(0, loan.outstandingBalance.toNumber() - amount);
    const reference = generateTransactionReference();

    const monthlyInterest = Math.round(loan.outstandingBalance.toNumber() * (loan.interestRate.toNumber() / 12) * 100) / 100;
    const principalPaid = Math.round(Math.max(0, amount - monthlyInterest) * 100) / 100;
    const balanceBefore = defaultAccount.balance.toNumber();

    await prisma.$transaction([
      prisma.loanPayment.create({
        data: {
          loanId: id,
          amount,
          principalPortion: principalPaid,
          interestPortion: Math.min(monthlyInterest, amount),
          paymentDate: new Date(),
          status: LoanPaymentStatus.PAID,
        },
      }),
      prisma.loan.update({
        where: { id },
        data: {
          outstandingBalance: newBalance,
          status: newBalance === 0 ? LoanStatus.PAID_OFF : LoanStatus.ACTIVE,
        },
      }),
      prisma.account.update({
        where: { id: defaultAccount.id },
        data: { balance: { decrement: amount } },
      }),
      prisma.transaction.create({
        data: {
          accountId: defaultAccount.id,
          type: TransactionType.DEBIT,
          amount,
          currency: defaultAccount.currency,
          balanceBefore,
          balanceAfter: balanceBefore - amount,
          category: TransactionCategory.LOAN_PAYMENT,
          description: `Loan repayment for loan ${id}`,
          reference,
          status: TransactionStatus.COMPLETED,
        },
      }),
    ]);

    return { loanId: id, amountPaid: amount, remainingBalance: newBalance };
  }

  async getEligibility(userId: string) {
    // Mock eligibility based on account activity
    const account = await prisma.account.findFirst({
      where: { userId },
      orderBy: { balance: 'desc' },
    });

    const balance = account?.balance.toNumber() ?? 0;
    const tier = balance > 50000 ? 'PREMIUM' : balance > 10000 ? 'STANDARD' : 'BASIC';

    const multipliers: Record<string, number> = {
      BASIC: 0.5,
      STANDARD: 1.0,
      PREMIUM: 2.0,
    };
    const multiplier = multipliers[tier];

    const eligibility: Record<string, number> = {};
    for (const [type, limit] of Object.entries(LOAN_LIMITS)) {
      eligibility[type] = Math.round(limit * multiplier);
    }

    return { tier, eligibility, annualRates: ANNUAL_RATES };
  }
}

export default new LoansService();

export const loansService = new LoansService();
