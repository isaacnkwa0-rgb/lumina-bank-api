import { Request, Response, NextFunction } from 'express';
import { kycService } from './kyc.service';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';
import { uploadBuffer } from '../../config/cloudinary';

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
      };

      const idFrontFile = files.idFront?.[0];
      const idBackFile = files.idBack?.[0];

      if (!idFrontFile || !idBackFile) {
        res.status(400).json({ success: false, error: { message: 'Both documents are required: idFront and idBack' } });
        return;
      }

      const resourceType = (f: Express.Multer.File) =>
        f.mimetype === 'application/pdf' ? 'raw' : 'image';

      const [idFrontUrl, idBackUrl] = await Promise.all([
        uploadBuffer(idFrontFile.buffer, 'lumina-bank/kyc', resourceType(idFrontFile)),
        uploadBuffer(idBackFile.buffer, 'lumina-bank/kyc', resourceType(idBackFile)),
      ]);

      const data = await kycService.submit(userId, { idFrontUrl, idBackUrl });
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
