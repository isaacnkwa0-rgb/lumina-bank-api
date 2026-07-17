import { Router } from 'express';
import { transactionsController } from './transactions.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', transactionsController.list);
router.get('/export', transactionsController.export);
router.get('/summary', transactionsController.summary);
router.get('/:id', transactionsController.get);

export { router as transactionsRouter };
