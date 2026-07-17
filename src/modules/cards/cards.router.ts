import { Router } from 'express';
import { z } from 'zod';
import { CardType, CardTier } from '@prisma/client';
import { cardsController } from './cards.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

const issueCardSchema = z.object({
  accountId: z.string().uuid(),
  type: z.nativeEnum(CardType).optional(),
  tier: z.nativeEnum(CardTier).optional(),
});

const issueVirtualSchema = z.object({
  accountId: z.string().uuid(),
});

const updateLimitsSchema = z
  .object({
    daily: z.number().positive().optional(),
    monthly: z.number().positive().optional(),
    perTransaction: z.number().positive().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one limit must be provided' });

const updateControlsSchema = z
  .object({
    online: z.boolean().optional(),
    contactless: z.boolean().optional(),
    international: z.boolean().optional(),
    atm: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one control must be provided' });

router.use(authenticate);

router.get('/', cardsController.list);
router.post('/', validate(issueCardSchema), cardsController.issue);
router.post('/virtual', validate(issueVirtualSchema), cardsController.issueVirtual);
router.get('/:id', cardsController.get);
router.post('/:id/freeze', cardsController.freeze);
router.post('/:id/unfreeze', cardsController.unfreeze);
router.patch('/:id/limits', validate(updateLimitsSchema), cardsController.updateLimits);
router.patch('/:id/controls', validate(updateControlsSchema), cardsController.updateControls);
router.post('/:id/replace', cardsController.replace);
router.post('/:id/report-lost', cardsController.reportLost);
router.get('/:id/transactions', cardsController.getTransactions);

export { router as cardsRouter };
