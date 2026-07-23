import { Router } from 'express';
import multer from 'multer';
import kycController from './kyc.controller';
import { authenticate } from '../../middleware/auth.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, _cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    _cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const kycUpload = upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
]);

const router = Router();

router.use(authenticate);

router.get('/status', kycController.getStatus.bind(kycController));
router.post('/submit', kycUpload, kycController.submit.bind(kycController));
router.get('/documents', kycController.getDocuments.bind(kycController));

export default router;
