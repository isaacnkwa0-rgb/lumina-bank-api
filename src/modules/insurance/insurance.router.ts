import { Router } from 'express';
import { z } from 'zod';
import { InsuranceType } from '@prisma/client';
import insuranceController from './insurance.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

const requestQuoteSchema = z.object({
  type:    z.nativeEnum(InsuranceType),
  details: z.record(z.string(), z.unknown()),
  notes:   z.string().max(1000).optional(),
});

router.use(authenticate);

router.post('/quotes', validate(requestQuoteSchema), insuranceController.requestQuote.bind(insuranceController));
router.get('/quotes', insuranceController.getQuotes.bind(insuranceController));
router.get('/quotes/:id', insuranceController.getQuote.bind(insuranceController));
router.patch('/quotes/:id/accept', insuranceController.acceptQuote.bind(insuranceController));
router.patch('/quotes/:id/cancel', insuranceController.cancelQuote.bind(insuranceController));

export default router;
