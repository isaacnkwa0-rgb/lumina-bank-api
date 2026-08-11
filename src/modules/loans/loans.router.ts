import { Router } from 'express';
import loansController from './loans.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

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

export default router;
