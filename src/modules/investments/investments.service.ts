import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { TransactionType, TransactionStatus, AssetType, TransactionCategory } from '@prisma/client';
import { generateTransactionReference } from '../../shared/utils/transaction-ref';

const MOCK_PRICES: Record<string, number> = {
  AAPL: 185,
  MSFT: 380,
  AMZN: 178,
  GOOGL: 145,
  BTC: 43000,
  ETH: 2600,
  SPY: 475,
  NVDA: 450,
  TSLA: 250,
};

const POPULAR_ASSETS = [
  { ticker: 'AAPL', name: 'Apple Inc.', type: 'STOCK' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', type: 'STOCK' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', type: 'STOCK' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', type: 'STOCK' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', type: 'STOCK' },
  { ticker: 'TSLA', name: 'Tesla Inc.', type: 'STOCK' },
  { ticker: 'META', name: 'Meta Platforms Inc.', type: 'STOCK' },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.', type: 'STOCK' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', type: 'STOCK' },
  { ticker: 'V', name: 'Visa Inc.', type: 'STOCK' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', type: 'STOCK' },
  { ticker: 'WMT', name: 'Walmart Inc.', type: 'STOCK' },
  { ticker: 'PG', name: 'Procter & Gamble Co.', type: 'STOCK' },
  { ticker: 'MA', name: 'Mastercard Inc.', type: 'STOCK' },
  { ticker: 'HD', name: 'The Home Depot Inc.', type: 'STOCK' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', type: 'ETF' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', type: 'ETF' },
  { ticker: 'BTC', name: 'Bitcoin', type: 'CRYPTO' },
  { ticker: 'ETH', name: 'Ethereum', type: 'CRYPTO' },
  { ticker: 'SOL', name: 'Solana', type: 'CRYPTO' },
];

function getMockPrice(ticker: string): number {
  return MOCK_PRICES[ticker] ?? 100;
}

export class InvestmentsService {
  async getPortfolio(userId: string) {
    const portfolio = await prisma.portfolio.findFirst({
      where: { userId },
      include: { holdings: true },
    });

    if (!portfolio) {
      return {
        portfolio: null,
        totalValue: 0,
        totalCost: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        allocationByType: {},
        holdings: [],
      };
    }

    const holdingsWithPrices = portfolio.holdings.map((h) => {
      const currentPrice = getMockPrice(h.ticker);
      const quantity = h.quantity.toNumber();
      const averageCost = h.averageCostBasis.toNumber();
      const currentValue = quantity * currentPrice;
      const costBasis = quantity * averageCost;
      const gainLoss = currentValue - costBasis;
      const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
      return { ...h, currentPrice, currentValue, gainLoss, gainLossPercent };
    });

    const totalValue = holdingsWithPrices.reduce((s, h) => s + h.currentValue, 0);
    const totalCost = holdingsWithPrices.reduce(
      (s, h) => s + h.quantity.toNumber() * h.averageCostBasis.toNumber(),
      0,
    );
    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    const allocationByType: Record<string, { value: number; percent: number }> = {};
    for (const h of holdingsWithPrices) {
      const type = h.assetType;
      if (!allocationByType[type]) allocationByType[type] = { value: 0, percent: 0 };
      allocationByType[type].value += h.currentValue;
    }
    for (const type of Object.keys(allocationByType)) {
      allocationByType[type].percent =
        totalValue > 0 ? (allocationByType[type].value / totalValue) * 100 : 0;
    }

    return {
      portfolio: { id: portfolio.id, name: portfolio.name, createdAt: portfolio.createdAt },
      totalValue,
      totalCost,
      totalGainLoss,
      totalGainLossPercent,
      allocationByType,
      holdings: holdingsWithPrices,
    };
  }

  async getHoldings(userId: string) {
    const result = await this.getPortfolio(userId);
    return result.holdings;
  }

  async buy(
    userId: string,
    data: {
      ticker: string;
      assetType: string;
      assetName: string;
      quantity?: number;
      amount?: number;
    },
  ) {
    const { ticker, assetType, assetName, quantity, amount } = data;

    if (!quantity && !amount) {
      throw new AppError('Provide either quantity or amount', 400);
    }

    const currentPrice = getMockPrice(ticker);
    const buyQuantity = quantity ?? (amount! / currentPrice);
    const totalCost = buyQuantity * currentPrice;

    let portfolio = await prisma.portfolio.findFirst({ where: { userId } });
    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: { userId, name: 'My Portfolio' },
      });
    }

    const defaultAccount = await prisma.account.findFirst({
      where: { userId, isDefault: true },
    });
    if (!defaultAccount) throw new AppError('No default account found', 404);
    if (defaultAccount.balance.toNumber() < totalCost) {
      throw new AppError('Insufficient funds', 400);
    }

    const existingHolding = await prisma.investment.findFirst({
      where: { portfolioId: portfolio.id, ticker },
    });

    if (existingHolding) {
      const existingQty = existingHolding.quantity.toNumber();
      const existingCost = existingHolding.averageCostBasis.toNumber();
      const newQty = existingQty + buyQuantity;
      const newAvgCost = (existingQty * existingCost + totalCost) / newQty;
      await prisma.investment.update({
        where: { id: existingHolding.id },
        data: { quantity: newQty, averageCostBasis: newAvgCost },
      });
    } else {
      await prisma.investment.create({
        data: {
          portfolioId: portfolio.id,
          ticker,
          assetType: assetType as AssetType,
          assetName,
          quantity: buyQuantity,
          averageCostBasis: currentPrice,
        },
      });
    }

    const reference = generateTransactionReference();
    const balanceBefore = defaultAccount.balance.toNumber();
    await prisma.$transaction([
      prisma.account.update({
        where: { id: defaultAccount.id },
        data: { balance: { decrement: totalCost } },
      }),
      prisma.transaction.create({
        data: {
          accountId: defaultAccount.id,
          type: TransactionType.DEBIT,
          amount: totalCost,
          currency: defaultAccount.currency,
          balanceBefore,
          balanceAfter: balanceBefore - totalCost,
          category: TransactionCategory.INVESTMENT,
          description: `Buy ${buyQuantity} ${ticker} @ $${currentPrice}`,
          reference,
          status: TransactionStatus.COMPLETED,
        },
      }),
    ]);

    return { ticker, quantity: buyQuantity, price: currentPrice, total: totalCost };
  }

  async sell(userId: string, data: { ticker: string; quantity: number }) {
    const { ticker, quantity } = data;

    const portfolio = await prisma.portfolio.findFirst({ where: { userId } });
    if (!portfolio) throw new AppError('Portfolio not found', 404);

    const holding = await prisma.investment.findFirst({
      where: { portfolioId: portfolio.id, ticker },
    });
    if (!holding) throw new AppError('Holding not found', 404);
    if (holding.quantity.toNumber() < quantity) {
      throw new AppError('Insufficient holdings', 400);
    }

    const currentPrice = getMockPrice(ticker);
    const proceeds = quantity * currentPrice;

    const defaultAccount = await prisma.account.findFirst({
      where: { userId, isDefault: true },
    });
    if (!defaultAccount) throw new AppError('No default account found', 404);

    const newQty = holding.quantity.toNumber() - quantity;
    const reference = generateTransactionReference();
    const balanceBefore = defaultAccount.balance.toNumber();

    await prisma.$transaction([
      newQty === 0
        ? prisma.investment.delete({ where: { id: holding.id } })
        : prisma.investment.update({
            where: { id: holding.id },
            data: { quantity: newQty },
          }),
      prisma.account.update({
        where: { id: defaultAccount.id },
        data: { balance: { increment: proceeds } },
      }),
      prisma.transaction.create({
        data: {
          accountId: defaultAccount.id,
          type: TransactionType.CREDIT,
          amount: proceeds,
          currency: defaultAccount.currency,
          balanceBefore,
          balanceAfter: balanceBefore + proceeds,
          category: TransactionCategory.INVESTMENT,
          description: `Sell ${quantity} ${ticker} @ $${currentPrice}`,
          reference,
          status: TransactionStatus.COMPLETED,
        },
      }),
    ]);

    return { ticker, quantity, price: currentPrice, proceeds };
  }

  async getPerformance(userId: string, period = '1M') {
    const result = await this.getPortfolio(userId);
    const currentValue = result.totalValue;

    const periodDays: Record<string, number> = {
      '1W': 7,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
    };
    const days = periodDays[period] ?? 30;

    const history: { date: string; value: number }[] = [];
    let value = currentValue * (0.85 + Math.random() * 0.1);

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const change = (Math.random() - 0.48) * 0.015;
      value = value * (1 + change);
      history.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100,
      });
    }

    history[history.length - 1].value = currentValue;
    return history;
  }

  async getWatchlist(userId: string) {
    const portfolio = await prisma.portfolio.findFirst({ where: { userId } });
    if (!portfolio) return [];
    const items = await prisma.watchlist.findMany({ where: { portfolioId: portfolio.id } });
    return items.map((item) => ({
      ...item,
      currentPrice: getMockPrice(item.ticker),
      change: (Math.random() - 0.48) * 10,
      changePercent: (Math.random() - 0.48) * 3,
    }));
  }

  async addToWatchlist(
    userId: string,
    data: { ticker: string; assetName: string; assetType: string },
  ) {
    let portfolio = await prisma.portfolio.findFirst({ where: { userId } });
    if (!portfolio) {
      portfolio = await prisma.portfolio.create({ data: { userId, name: 'My Portfolio' } });
    }
    const existing = await prisma.watchlist.findFirst({
      where: { portfolioId: portfolio.id, ticker: data.ticker },
    });
    if (existing) throw new AppError('Already in watchlist', 400);
    return prisma.watchlist.create({
      data: {
        portfolioId: portfolio.id,
        ticker: data.ticker,
        assetName: data.assetName,
        assetType: data.assetType as AssetType,
      },
    });
  }

  async removeFromWatchlist(userId: string, ticker: string) {
    const portfolio = await prisma.portfolio.findFirst({ where: { userId } });
    if (!portfolio) throw new AppError('Watchlist item not found', 404);
    const item = await prisma.watchlist.findFirst({ where: { portfolioId: portfolio.id, ticker } });
    if (!item) throw new AppError('Watchlist item not found', 404);
    await prisma.watchlist.delete({ where: { id: item.id } });
    return { message: 'Removed from watchlist' };
  }

  async getMarketQuote(ticker: string) {
    const price = getMockPrice(ticker.toUpperCase());
    const change = (Math.random() - 0.48) * price * 0.03;
    return {
      ticker: ticker.toUpperCase(),
      price,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round((change / price) * 10000) / 100,
      high: Math.round((price + Math.abs(change) * 1.5) * 100) / 100,
      low: Math.round((price - Math.abs(change) * 1.5) * 100) / 100,
      volume: Math.floor(Math.random() * 50000000) + 1000000,
      marketCap: Math.floor(price * (Math.random() * 5e9 + 1e9)),
    };
  }

  async searchAssets(query: string) {
    const q = query.toLowerCase();
    return POPULAR_ASSETS.filter(
      (a) => a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
    );
  }
}

export default new InvestmentsService();

export const investmentsService = new InvestmentsService();
