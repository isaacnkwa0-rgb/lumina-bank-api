import { Router } from 'express';
import multer from 'multer';
import loansController from './loans.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

const docUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype) as any);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

router.get('/', loansController.getLoans.bind(loansController));
router.get('/eligibility', loansController.getEligibility.bind(loansController));
router.post('/apply', loansController.applyForLoan.bind(loansController));
router.get('/:id', loansController.getLoan.bind(loansController));
router.get('/:id/schedule', loansController.getAmortizationSchedule.bind(loansController));
router.get('/:id/payments', loansController.getPayments.bind(loansController));
router.post('/:id/repay', loansController.repay.bind(loansController));
router.patch('/:id/draft', loansController.saveDraft.bind(loansController));
router.post('/:id/submit', loansController.submitApplication.bind(loansController));
router.get('/:id/application', loansController.getApplicationData.bind(loansController));
router.post('/:id/document', docUpload, loansController.uploadDocument.bind(loansController));

export default router;
