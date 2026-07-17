import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { logger } from '../../config/logger';

const BANK_SPREAD = 0.015;
const STANDARD_FX_FEE_PCT = 0.005;
const RATES_API_URL = 'https://open.er-api.com/v6/latest/GBP';

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

      await Promise.all(upserts);
      logger.info(`Refreshed ${upserts.length} exchange rates from live API`);
    } catch (err: unknown) {
      logger.error('Failed to refresh exchange rates', { err: (err as Error).message });
    }
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
