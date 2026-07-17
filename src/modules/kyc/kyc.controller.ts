import { Request, Response, NextFunction } from 'express';
import { kycService } from './kyc.service';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class KycController {
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await kycService.getStatus(userId);
      sendSuccess(res, data, 'KYC status retrieved');
    } catch (err) {
      next(err);
    }
  }

  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const files = req.files as {
        idFront?: Express.Multer.File[];
        idBack?: Express.Multer.File[];
        selfie?: Express.Multer.File[];
      };
      const data = await kycService.submit(userId, files);
      sendCreated(res, data, 'KYC documents submitted');
    } catch (err) {
      next(err);
    }
  }

  async getDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await kycService.getDocuments(userId);
      sendSuccess(res, data, 'KYC documents retrieved');
    } catch (err) {
      next(err);
    }
  }
}

export default new KycController();
