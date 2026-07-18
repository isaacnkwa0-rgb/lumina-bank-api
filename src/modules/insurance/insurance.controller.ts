import { Request, Response, NextFunction } from 'express';
import { insuranceService } from './insurance.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class InsuranceController {
  async requestQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await insuranceService.requestQuote(req.user!.id, req.body);
      sendSuccess(res, data, 'Quote created', 201);
    } catch (err) { next(err); }
  }

  async getQuotes(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await insuranceService.getQuotes(req.user!.id);
      sendSuccess(res, data, 'Quotes retrieved');
    } catch (err) { next(err); }
  }

  async getQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await insuranceService.getQuote(req.params.id as string, req.user!.id);
      sendSuccess(res, data, 'Quote retrieved');
    } catch (err) { next(err); }
  }

  async acceptQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await insuranceService.acceptQuote(req.params.id as string, req.user!.id);
      sendSuccess(res, data, 'Quote accepted');
    } catch (err) { next(err); }
  }

  async cancelQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await insuranceService.cancelQuote(req.params.id as string, req.user!.id);
      sendSuccess(res, data, 'Quote cancelled');
    } catch (err) { next(err); }
  }
}

export default new InsuranceController();
