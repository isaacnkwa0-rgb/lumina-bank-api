import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import kycController from './kyc.controller';
import { authenticate } from '../../middleware/auth.middleware';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/kyc');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const imageOnly = ['image/jpeg', 'image/png', 'image/jpg'];
  const imageAndPdf = [...imageOnly, 'application/pdf'];

  if (file.fieldname === 'selfie') {
    if (imageOnly.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Selfie must be a JPEG or PNG image'));
    }
  } else {
    if (imageAndPdf.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
    }
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const kycUpload = upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'selfie', maxCount: 2 },
]);

const router = Router();

router.use(authenticate);

router.get('/status', kycController.getStatus.bind(kycController));
router.post('/submit', kycUpload, kycController.submit.bind(kycController));
router.get('/documents', kycController.getDocuments.bind(kycController));

export default router;
