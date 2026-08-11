import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { logger } from '../../config/logger';

const BANK_SPREAD = 0.015;
const STANDARD_FX_FEE_PCT = 0.005;
const RATES_API_URL = 'https://open.er-api.com/v6/latest/GBP';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,binancecoin,solana,ripple,cardano,dogecoin&vs_currencies=gbp';

const CRYPTO_ID_MAP: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', tether: 'USDT',
  binancecoin: 'BNB', solana: 'SOL', ripple: 'XRP',
  cardano: 'ADA', dogecoin: 'DOGE',
};

export class RatesService {
  async refreshRates(): Promise<void> {
    try {
      const res = await fetch(RATES_API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { result: string; rates: Record<string, number>; time_last_update_utc: string };
      if (json.result !== 'success') throw new Error('API returned non-success');

      const now = new Date();
      const upserts = Object.entries(json.rates)
        .filter(([code]) => code !== 'GBP')
        .map(([quoteCurrency, rate]) =>
          prisma.exchangeRate.upsert({
            where: { baseCurrency_quoteCurrency: { baseCurrency: 'GBP', quoteCurrency } },
            update: { rate, fetchedAt: now },
            create: { baseCurrency: 'GBP', quoteCurrency, rate, fetchedAt: now },
          })
        );

      await prisma.$transaction(upserts);
      logger.info(`Refreshed ${upserts.length} exchange rates from live API`);
    } catch (err: unknown) {
      logger.error('Failed to refresh exchange rates', { err: (err as Error).message });
    }
  }

  async refreshCryptoPrices(): Promise<void> {
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
      const json = await res.json() as Record<string, { gbp: number }>;
      const now = new Date();
      const upserts = Object.entries(json)
        .filter(([id]) => CRYPTO_ID_MAP[id])
        .map(([id, prices]) => {
          const symbol = CRYPTO_ID_MAP[id];
          const priceGbp = prices.gbp;
          return prisma.exchangeRate.upsert({
            where: { baseCurrency_quoteCurrency: { baseCurrency: symbol, quoteCurrency: 'GBP' } },
            update: { rate: priceGbp, fetchedAt: now },
            create: { baseCurrency: symbol, quoteCurrency: 'GBP', rate: priceGbp, fetchedAt: now },
          });
        });
      await prisma.$transaction(upserts);
      logger.info(`Refreshed ${upserts.length} crypto prices from CoinGecko`);
    } catch (err: unknown) {
      logger.error('Failed to refresh crypto prices', { err: (err as Error).message });
    }
  }

  async getCryptoPricesGbp(): Promise<Record<string, number>> {
    const coins = Object.values(CRYPTO_ID_MAP);
    const rows = await prisma.exchangeRate.findMany({
      where: { quoteCurrency: 'GBP', baseCurrency: { in: coins } },
    });
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.baseCurrency] = Number(row.rate);
    }
    return result;
  }

  async getRate(baseCurrency: string, quoteCurrency: string) {
    if (baseCurrency === quoteCurrency) return { mid: 1, customerRate: 1, spread: 0 };

    const rate = await prisma.exchangeRate.findUnique({
      where: { baseCurrency_quoteCurrency: { baseCurrency, quoteCurrency } },
    });

    if (!rate) {
      const inverse = await prisma.exchangeRate.findUnique({
        where: { baseCurrency_quoteCurrency: { baseCurrency: quoteCurrency, quoteCurrency: baseCurrency } },
      });
      if (!inverse) throw new AppError(`Currency pair ${baseCurrency}/${quoteCurrency} not supported`, 400, ErrorCodes.RATE_001);
      const mid = 1 / Number(inverse.rate);
      const customerRate = mid * (1 - BANK_SPREAD);
      return { mid, customerRate, spread: BANK_SPREAD };
    }

    const mid = Number(rate.rate);
    const customerRate = mid * (1 - BANK_SPREAD);
    return { mid, customerRate, spread: BANK_SPREAD, fetchedAt: rate.fetchedAt };
  }

  async getQuote(fromCurrency: string, toCurrency: string, amount: number) {
    const { mid, customerRate } = await this.getRate(fromCurrency, toCurrency);
    const convertedAmount = amount * customerRate;
    const fxFee = amount * STANDARD_FX_FEE_PCT;
    return {
      fromCurrency,
      toCurrency,
      amount,
      customerRate,
      midRate: mid,
      convertedAmount,
      fxFee,
      totalDeducted: amount + fxFee,
      validForSeconds: 30,
      timestamp: new Date().toISOString(),
    };
  }

  async getAllRates() {
    const rows = await prisma.exchangeRate.findMany({
      orderBy: [{ baseCurrency: 'asc' }, { quoteCurrency: 'asc' }],
    });
    return rows.map((r) => ({
      from: r.baseCurrency,
      to: r.quoteCurrency,
      rate: Number(r.rate),
      fetchedAt: r.fetchedAt,
    }));
  }

  async convert(from: string, to: string, amount: number) {
    const { customerRate } = await this.getRate(from, to);
    return {
      from,
      to,
      amount,
      converted: amount * customerRate,
      rate: customerRate,
    };
  }
}

export const ratesService = new RatesService();
