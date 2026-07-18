import { Router } from 'express';
import { z } from 'zod';
import cryptoController from './crypto.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

router.use(authenticate);

const createOrderSchema = z.object({
  accountId:     z.string().min(1),
  coin:          z.string().min(1).max(20),
  coinId:        z.string().min(1).max(50),
  network:       z.string().min(1).max(80),
  walletAddress: z.string().min(8).max(200),
  amountGbp:    z.number().positive(),
  priceGbp:     z.number().positive(),
});

router.post('/orders', validate(createOrderSchema), cryptoController.createOrder.bind(cryptoController));
router.get('/orders', cryptoController.listOrders.bind(cryptoController));
router.get('/orders/:id', cryptoController.getOrder.bind(cryptoController));

export default router;
