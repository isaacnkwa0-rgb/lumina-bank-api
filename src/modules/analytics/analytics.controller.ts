import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class AnalyticsController {
  async getSpendingByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { accountId, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
      const data = await analyticsService.getSpendingByCategory(userId, accountId, dateFrom, dateTo);
      sendSuccess(res, data, 'Spending by category retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getCashflow(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const months = req.query.months ? parseInt(req.query.months as string, 10) : 12;
      const data = await analyticsService.getCashflow(userId, months);
      sendSuccess(res, data, 'Cashflow retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getBalanceHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { accountId, dateFrom, dateTo, interval } = req.query as Record<string, string | undefined>;
      const data = await analyticsService.getBalanceHistory(
        userId,
        accountId as string,
        dateFrom,
        dateTo,
        (interval as 'daily' | 'weekly') ?? 'daily',
      );
      sendSuccess(res, data, 'Balance history retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getTopMerchants(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { accountId, dateFrom, dateTo, limit } = req.query as Record<string, string | undefined>;
      const data = await analyticsService.getTopMerchants(
        userId,
        accountId,
        dateFrom,
        dateTo,
        limit ? parseInt(limit, 10) : 10,
      );
      sendSuccess(res, data, 'Top merchants retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await analyticsService.getInsights(userId);
      sendSuccess(res, data, 'Insights retrieved');
    } catch (err) {
      next(err);
    }
  }
}

export default new AnalyticsController();
