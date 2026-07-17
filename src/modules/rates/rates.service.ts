import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';

const BANK_SPREAD = 0.015;
const STANDARD_FX_FEE_PCT = 0.005;

export class RatesService {
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
    return prisma.exchangeRate.findMany({ orderBy: [{ baseCurrency: 'asc' }, { quoteCurrency: 'asc' }] });
  }

  async convert(fromCurrency: string, toCurrency: string, amount: number) {
    const { customerRate } = await this.getRate(fromCurrency, toCurrency);
    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: amount * customerRate,
      rate: customerRate,
    };
  }
}

export const ratesService = new RatesService();
