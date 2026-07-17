import { Router } from 'express';
import analyticsController from './analytics.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/spending', analyticsController.getSpendingByCategory.bind(analyticsController));
router.get('/cashflow', analyticsController.getCashflow.bind(analyticsController));
router.get('/balance-history', analyticsController.getBalanceHistory.bind(analyticsController));
router.get('/top-merchants', analyticsController.getTopMerchants.bind(analyticsController));
router.get('/insights', analyticsController.getInsights.bind(analyticsController));

export default router;
