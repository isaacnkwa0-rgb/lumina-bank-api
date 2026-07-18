import { Request, Response, NextFunction } from 'express';
import { disputesService } from './disputes.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class DisputesController {
  async createDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await disputesService.createDispute(req.user!.id, req.body);
      sendSuccess(res, data, 'Dispute submitted', 201);
    } catch (err) { next(err); }
  }

  async getDisputes(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await disputesService.getDisputes(req.user!.id);
      sendSuccess(res, data, 'Disputes retrieved');
    } catch (err) { next(err); }
  }

  async getDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await disputesService.getDispute(req.params.id as string, req.user!.id);
      sendSuccess(res, data, 'Dispute retrieved');
    } catch (err) { next(err); }
  }

  async closeDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await disputesService.closeDispute(req.params.id as string, req.user!.id);
      sendSuccess(res, data, 'Dispute closed');
    } catch (err) { next(err); }
  }
}

export default new DisputesController();
