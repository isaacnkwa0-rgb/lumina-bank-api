import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { TransactionType, TransactionStatus, Prisma } from '@prisma/client';

export class AnalyticsService {
  async getSpendingByCategory(
    userId: string,
    accountId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    const where: Prisma.TransactionWhereInput = {
      accountId: accountId ? accountId : { in: accountIds },
      type: TransactionType.DEBIT,
      status: TransactionStatus.COMPLETED,
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const grouped = await prisma.transaction.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    const totalSpend = grouped.reduce(
      (sum, g) => sum + (g._sum.amount?.toNumber() ?? 0),
      0,
    );

    return grouped.map((g) => {
      const total = g._sum.amount?.toNumber() ?? 0;
      return {
        category: g.category,
        total,
        count: g._count.id,
        percentage: totalSpend > 0 ? Math.round((total / totalSpend) * 10000) / 100 : 0,
      };
    });
  }

  async getCashflow(userId: string, months = 12) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    const now = new Date();
    const result: { month: string; income: number; expenses: number; net: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const monthLabel = start.toLocaleString('default', { month: 'short', year: 'numeric' });

      const [creditResult, debitResult] = await Promise.all([
        prisma.transaction.aggregate({
          where: {
            accountId: { in: accountIds },
            type: TransactionType.CREDIT,
            status: TransactionStatus.COMPLETED,
            createdAt: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: {
            accountId: { in: accountIds },
            type: TransactionType.DEBIT,
            status: TransactionStatus.COMPLETED,
            createdAt: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
      ]);

      const income = creditResult._sum.amount?.toNumber() ?? 0;
      const expenses = debitResult._sum.amount?.toNumber() ?? 0;

      result.push({ month: monthLabel, income, expenses, net: income - expenses });
    }

    return result;
  }

  async getBalanceHistory(
    userId: string,
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
    interval: 'daily' | 'weekly' = 'daily',
  ) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new AppError('Account not found', 404);

    const where: Prisma.TransactionWhereInput = {
      accountId,
      status: TransactionStatus.COMPLETED,
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: { amount: true, type: true, createdAt: true },
    });

    let runningBalance = 0;
    const dailyMap = new Map<string, number>();

    for (const tx of transactions) {
      const delta = tx.type === TransactionType.CREDIT
        ? tx.amount.toNumber()
        : -tx.amount.toNumber();
      runningBalance += delta;

      let key: string;
      if (interval === 'weekly') {
        const d = new Date(tx.createdAt);
        const dayOfWeek = d.getDay();
        const sunday = new Date(d);
        sunday.setDate(d.getDate() - dayOfWeek);
        key = sunday.toISOString().split('T')[0];
      } else {
        key = new Date(tx.createdAt).toISOString().split('T')[0];
      }

      dailyMap.set(key, runningBalance);
    }

    return Array.from(dailyMap.entries()).map(([date, balance]) => ({ date, balance }));
  }

  async getTopMerchants(
    userId: string,
    accountId?: string,
    dateFrom?: string,
    dateTo?: string,
    limit = 10,
  ) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    const where: Prisma.TransactionWhereInput = {
      accountId: accountId ? accountId : { in: accountIds },
      type: TransactionType.DEBIT,
      status: TransactionStatus.COMPLETED,
      merchantName: { not: null },
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const grouped = await prisma.transaction.groupBy({
      by: ['merchantName'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    return grouped.map((g) => ({
      merchantName: g.merchantName,
      total: g._sum.amount?.toNumber() ?? 0,
      count: g._count.id,
    }));
  }

  async getInsights(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonthGrouped, lastMonthGrouped] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['category'],
        where: {
          accountId: { in: accountIds },
          type: TransactionType.DEBIT,
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: thisMonthStart },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['category'],
        where: {
          accountId: { in: accountIds },
          type: TransactionType.DEBIT,
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const insights: {
      type: string;
      title: string;
      body: string;
      severity: 'info' | 'warning' | 'success';
    }[] = [];

    const thisMonthMap = new Map<string, number>();
    const lastMonthMap = new Map<string, number>();
    let thisMonthTotal = 0;

    for (const g of thisMonthGrouped) {
      const val = g._sum.amount?.toNumber() ?? 0;
      thisMonthMap.set(g.category ?? 'UNCATEGORIZED', val);
      thisMonthTotal += val;
    }
    for (const g of lastMonthGrouped) {
      lastMonthMap.set(g.category ?? 'UNCATEGORIZED', g._sum.amount?.toNumber() ?? 0);
    }

    // Compare this month vs last month per category
    for (const [category, thisAmount] of thisMonthMap.entries()) {
      const lastAmount = lastMonthMap.get(category) ?? 0;
      if (lastAmount > 0) {
        const changePercent = ((thisAmount - lastAmount) / lastAmount) * 100;
        if (changePercent > 20) {
          insights.push({
            type: 'spending_increase',
            title: `${category} spending up ${Math.round(changePercent)}%`,
            body: `You spent $${thisAmount.toFixed(2)} on ${category} this month, up from $${lastAmount.toFixed(2)} last month.`,
            severity: 'warning',
          });
        }
      }
    }

    // Detect category > 40% of total spend
    for (const [category, amount] of thisMonthMap.entries()) {
      if (thisMonthTotal > 0 && amount / thisMonthTotal > 0.4) {
        insights.push({
          type: 'high_category_spend',
          title: `${category} dominates your spending`,
          body: `${category} accounts for ${Math.round((amount / thisMonthTotal) * 100)}% of your total spending this month.`,
          severity: 'warning',
        });
      }
    }

    // Savings rate from salary transactions
    const salaryThisMonth = await prisma.transaction.aggregate({
      where: {
        accountId: { in: accountIds },
        type: TransactionType.CREDIT,
        status: TransactionStatus.COMPLETED,
        category: 'SALARY',
        createdAt: { gte: thisMonthStart },
      },
      _sum: { amount: true },
    });

    const salaryAmount = salaryThisMonth._sum.amount?.toNumber() ?? 0;
    if (salaryAmount > 0) {
      const savingsRate = ((salaryAmount - thisMonthTotal) / salaryAmount) * 100;
      if (savingsRate > 0) {
        insights.push({
          type: 'savings_rate',
          title: `You saved ${Math.round(savingsRate)}% this month`,
          body: `Great job! You saved $${(salaryAmount - thisMonthTotal).toFixed(2)} out of your $${salaryAmount.toFixed(2)} income.`,
          severity: 'success',
        });
      } else {
        insights.push({
          type: 'savings_rate',
          title: 'Spending exceeded income this month',
          body: `Your expenses exceeded your income by $${Math.abs(salaryAmount - thisMonthTotal).toFixed(2)}.`,
          severity: 'warning',
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        type: 'no_insights',
        title: 'No significant insights this month',
        body: 'Your spending looks balanced. Keep it up!',
        severity: 'info',
      });
    }

    return insights;
  }
}

export default new AnalyticsService();

export const analyticsService = new AnalyticsService();
