import { Router } from 'express';
import { z } from 'zod';
import { directDebitsController } from './direct-debits.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

const createSchema = z.object({
  accountId:     z.string().uuid(),
  originatorName: z.string().min(1).max(100),
  originatorRef:  z.string().min(1).max(50),
  userRef:        z.string().min(1).max(50),
  amount:         z.number().positive().optional(),
  currency:       z.string().length(3).toUpperCase().optional(),
  frequency:      z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY']),
  startDate:      z.string().datetime(),
});

router.use(authenticate);

router.get('/',                               directDebitsController.list);
router.post('/', validate(createSchema),      directDebitsController.create);
router.patch('/:id/cancel',                   directDebitsController.cancel);
router.patch('/:id/suspend',                  directDebitsController.suspend);
router.patch('/:id/resume',                   directDebitsController.resume);
router.post('/collect-due',                   directDebitsController.collectDue);

export { router as directDebitsRouter };
