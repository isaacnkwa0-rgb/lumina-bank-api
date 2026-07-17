import { Request, Response, NextFunction } from 'express';
import { disputesService } from './disputes.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class DisputesController {
  async createDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { subject, description, transactionId } = req.body;
      if (!subject || !description) {
        res.status(400).json({ message: 'subject and description are required' });
        return;
      }
      const data = await disputesService.createDispute(userId, { subject, description, transactionId });
      sendSuccess(res, data, 'Dispute submitted', 201);
    } catch (err) {
      next(err);
    }
  }

  async getDisputes(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await disputesService.getDisputes(userId);
      sendSuccess(res, data, 'Disputes retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await disputesService.getDispute(req.params.id as string, userId);
      sendSuccess(res, data, 'Dispute retrieved');
    } catch (err) {
      next(err);
    }
  }
}

export default new DisputesController();
