import { Request, Response, NextFunction } from 'express';
import { insuranceService } from './insurance.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class InsuranceController {
  async requestQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { type, details, notes } = req.body;
      if (!type || !details) {
        res.status(400).json({ message: 'type and details are required' });
        return;
      }
      const data = await insuranceService.requestQuote(userId, { type, details, notes });
      sendSuccess(res, data, 'Quote created', 201);
    } catch (err) {
      next(err);
    }
  }

  async getQuotes(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await insuranceService.getQuotes(userId);
      sendSuccess(res, data, 'Quotes retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await insuranceService.getQuote(req.params.id, userId);
      sendSuccess(res, data, 'Quote retrieved');
    } catch (err) {
      next(err);
    }
  }

  async acceptQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await insuranceService.acceptQuote(req.params.id, userId);
      sendSuccess(res, data, 'Quote accepted');
    } catch (err) {
      next(err);
    }
  }
}

export default new InsuranceController();
