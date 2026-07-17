import { Request, Response, NextFunction } from 'express';
import { transfersService } from './transfers.service';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class TransfersController {
  async internal(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await transfersService.internal(req.user!.id, req.body);
      sendCreated(res, result, 'Transfer completed successfully');
    } catch (err) { next(err); }
  }

  async domestic(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await transfersService.domestic(req.user!.id, req.body);
      sendCreated(res, result, 'Transfer sent successfully');
    } catch (err) { next(err); }
  }

  async international(req: Request, res: Response, next: NextFunction) {
    try {
      const { transfer } = await transfersService.international(req.user!.id, req.body);
      sendCreated(res, transfer, 'International transfer submitted — processing 3–5 business days');
    } catch (err) { next(err); }
  }

  async schedule(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await transfersService.schedule(req.user!.id, req.body);
      sendCreated(res, result, 'Transfer scheduled successfully');
    } catch (err) { next(err); }
  }

  async getScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await transfersService.getScheduled(req.user!.id);
      sendSuccess(res, result, 'Scheduled transfers retrieved');
    } catch (err) { next(err); }
  }

  async cancelScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await transfersService.cancelScheduled((req.params.id as string), req.user!.id);
      sendSuccess(res, result, 'Transfer cancelled');
    } catch (err) { next(err); }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, type, status } = req.query as any;
      const result = await transfersService.getTransfers(req.user!.id, {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        type,
        status,
      });
      sendSuccess(res, result.transfers, 'Transfers retrieved', 200, result.meta);
    } catch (err) { next(err); }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const transfer = await transfersService.getTransfer((req.params.id as string), req.user!.id);
      sendSuccess(res, transfer, 'Transfer retrieved');
    } catch (err) { next(err); }
  }

  async quote(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromCurrency, toCurrency, amount } = req.body;
      const result = await transfersService.getFxQuote(fromCurrency, toCurrency, Number(amount));
      sendSuccess(res, result, 'Quote retrieved');
    } catch (err) { next(err); }
  }
}

export const transfersController = new TransfersController();
