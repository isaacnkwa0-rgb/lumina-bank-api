import { Request, Response, NextFunction } from 'express';
import { ratesService } from './rates.service';
import { sendSuccess } from '../../shared/utils/api-response';
import { SUPPORTED_CURRENCIES } from '../../shared/constants/currencies';

export class RatesController {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const rates = await ratesService.getAllRates();
      sendSuccess(res, rates, 'Exchange rates retrieved');
    } catch (err) { next(err); }
  }

  async getRate(req: Request, res: Response, next: NextFunction) {
    try {
      const base = req.params.base as string;
      const quote = req.params.quote as string;
      const rate = await ratesService.getRate(base.toUpperCase(), quote.toUpperCase());
      sendSuccess(res, rate, 'Exchange rate retrieved');
    } catch (err) { next(err); }
  }

  async convert(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to, amount } = req.query as any;
      const result = await ratesService.convert(from.toUpperCase(), to.toUpperCase(), Number(amount));
      sendSuccess(res, result, 'Conversion calculated');
    } catch (err) { next(err); }
  }

  getSupportedCurrencies(_req: Request, res: Response) {
    sendSuccess(res, SUPPORTED_CURRENCIES, 'Supported currencies');
  }
}

export const ratesController = new RatesController();
