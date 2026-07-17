import { Router } from 'express';
import insuranceController from './insurance.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/quotes', insuranceController.requestQuote.bind(insuranceController));
router.get('/quotes', insuranceController.getQuotes.bind(insuranceController));
router.get('/quotes/:id', insuranceController.getQuote.bind(insuranceController));
router.patch('/quotes/:id/accept', insuranceController.acceptQuote.bind(insuranceController));

export default router;
