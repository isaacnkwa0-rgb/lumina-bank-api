import { Router } from 'express';
import { transfersController } from './transfers.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { transferLimiter } from '../../middleware/rate-limit.middleware';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const internalSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.number().positive().max(1000000),
  description: z.string().min(1).max(255),
});

const domesticSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountNumber: z.string().min(8).max(64),  // 64 to allow crypto wallet addresses
  toBankCode: z.string().min(2).max(10),
  toAccountName: z.string().min(1).max(100),
  amount: z.number().positive().max(1000000),
  description: z.string().min(1).max(255),
  saveBeneficiary: z.boolean().optional(),
});

const internationalSchema = z.object({
  fromAccountId: z.string().uuid(),
  toIban: z.string().min(15).max(34),
  swiftCode: z.string().min(8).max(11),
  toBankName: z.string().min(1).max(100),
  toAccountName: z.string().min(1).max(100),
  toCountry: z.string().length(2).toUpperCase(),
  toCurrency: z.string().length(3).toUpperCase(),
  amount: z.number().positive().max(1000000),
  description: z.string().min(1).max(255),
});

const scheduleSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountNumber: z.string().min(8).max(20),
  toBankCode: z.string().min(2).max(10),
  toAccountName: z.string().min(1).max(100),
  amount: z.number().positive().max(1000000),
  description: z.string().min(1).max(255),
  scheduledAt: z.string().datetime(),
});

const quoteSchema = z.object({
  fromCurrency: z.string().length(3).toUpperCase(),
  toCurrency: z.string().length(3).toUpperCase(),
  amount: z.number().positive(),
});

router.get('/', transfersController.list);
router.get('/scheduled', transfersController.getScheduled);
router.get('/:id', transfersController.get);
router.post('/internal', transferLimiter, validate(internalSchema), transfersController.internal);
router.post('/domestic', transferLimiter, validate(domesticSchema), transfersController.domestic);
router.post('/international', transferLimiter, validate(internationalSchema), transfersController.international);
router.post('/schedule', validate(scheduleSchema), transfersController.schedule);
router.post('/quote', validate(quoteSchema), transfersController.quote);
router.delete('/:id/cancel', transfersController.cancelScheduled);

export { router as transfersRouter };
