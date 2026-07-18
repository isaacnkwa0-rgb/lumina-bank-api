import { Router } from 'express';
import { standingOrdersController } from './standing-orders.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountNumber: z.string().min(8).max(34),
  toBankCode: z.string().min(2).max(10),
  toAccountName: z.string().min(1).max(100),
  amount: z.number().positive().max(100000),
  description: z.string().min(1).max(255),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

router.get('/', standingOrdersController.list);
router.post('/', validate(createSchema), standingOrdersController.create);
router.patch('/:id/cancel', standingOrdersController.cancel);
router.patch('/:id/pause', standingOrdersController.pause);
router.patch('/:id/resume', standingOrdersController.resume);
router.post('/execute-due', standingOrdersController.executeDue);

export default router;
