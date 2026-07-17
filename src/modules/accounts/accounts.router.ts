import { Router } from 'express';
import { accountsController } from './accounts.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';
import { AccountType } from '@prisma/client';

const router = Router();

const createAccountSchema = z.object({
  type: z.nativeEnum(AccountType),
  currency: z.string().length(3).toUpperCase().optional(),
  interestRate: z.number().min(0).max(100).optional(),
  maturityDate: z.string().date().optional(),
});

router.use(authenticate);

router.get('/', accountsController.list);
router.post('/', validate(createAccountSchema), accountsController.create);
router.get('/:id', accountsController.get);
router.patch('/:id/default', accountsController.setDefault);
router.post('/:id/freeze', accountsController.freeze);
router.post('/:id/unfreeze', accountsController.unfreeze);
router.post('/:id/close', accountsController.closeAccount);
router.get('/:id/balance', accountsController.getBalance);
router.get('/:id/statement', accountsController.getStatement);

export { router as accountsRouter };
