import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import depositsController from './deposits.controller';

const router = Router();

router.use(authenticate);

router.get('/coins', depositsController.getSupportedCoins.bind(depositsController));
router.get('/', depositsController.listDeposits.bind(depositsController));
router.get('/:id', depositsController.getDeposit.bind(depositsController));
router.post('/bank-transfer', depositsController.initiateBankTransfer.bind(depositsController));
router.post('/crypto', depositsController.initiateCryptoDeposit.bind(depositsController));

export default router;
