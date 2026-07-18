import { Request, Response, NextFunction } from 'express';
import { directDebitsService } from './direct-debits.service';
import { sendSuccess } from '../../shared/utils/api-response';

export const directDebitsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await directDebitsService.list(req.user!.id);
      sendSuccess(res, data);
    } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const dd = await directDebitsService.create(req.user!.id, req.body);
      sendSuccess(res, dd, 'Direct debit set up', 201);
    } catch (e) { next(e); }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const dd = await directDebitsService.cancel(req.params.id, req.user!.id);
      sendSuccess(res, dd, 'Direct debit cancelled');
    } catch (e) { next(e); }
  },

  async suspend(req: Request, res: Response, next: NextFunction) {
    try {
      const dd = await directDebitsService.suspend(req.params.id, req.user!.id);
      sendSuccess(res, dd, 'Direct debit suspended');
    } catch (e) { next(e); }
  },

  async resume(req: Request, res: Response, next: NextFunction) {
    try {
      const dd = await directDebitsService.resume(req.params.id, req.user!.id);
      sendSuccess(res, dd, 'Direct debit resumed');
    } catch (e) { next(e); }
  },

  async collectDue(req: Request, res: Response, next: NextFunction) {
    try {
      const results = await directDebitsService.collectDue();
      sendSuccess(res, results, `Processed ${results.length} direct debits`);
    } catch (e) { next(e); }
  },
};
