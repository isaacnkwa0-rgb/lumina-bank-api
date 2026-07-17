import { Request, Response, NextFunction } from 'express';
import { transactionsService } from './transactions.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class TransactionsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, type, category, status, dateFrom, dateTo, amountMin, amountMax, search, page, limit } = req.query as any;
      const result = await transactionsService.getTransactions(req.user!.id, {
        accountId,
        type,
        category,
        status,
        dateFrom,
        dateTo,
        amountMin: amountMin ? Number(amountMin) : undefined,
        amountMax: amountMax ? Number(amountMax) : undefined,
        search,
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      });
      sendSuccess(res, result.transactions, 'Transactions retrieved', 200, result.meta);
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const transaction = await transactionsService.getTransaction(req.params.id as string, req.user!.id);
      sendSuccess(res, transaction, 'Transaction retrieved');
    } catch (err) {
      next(err);
    }
  }

  async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, dateFrom, dateTo } = req.query as any;
      const result = await transactionsService.getSummary(req.user!.id, accountId, dateFrom, dateTo);
      sendSuccess(res, result, 'Summary retrieved');
    } catch (err) {
      next(err);
    }
  }

  async export(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, dateFrom, dateTo } = req.query as any;
      const csv = await transactionsService.exportCsv(req.user!.id, accountId, dateFrom, dateTo);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }
}

export const transactionsController = new TransactionsController();
