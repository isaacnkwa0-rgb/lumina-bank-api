import { Router } from 'express';
import { z } from 'zod';
import { beneficiariesController } from './beneficiaries.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

const createBeneficiarySchema = z.object({
  nickname: z.string().min(1).max(60),
  accountName: z.string().min(1).max(100),
  accountNumber: z.string().min(6).max(20),
  bankName: z.string().min(1).max(100),
  bankCode: z.string().min(1).max(20),
  iban: z.string().max(34).optional(),
  swiftCode: z.string().max(11).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  isFavorite: z.boolean().optional(),
});

const updateBeneficiarySchema = z.object({
  nickname: z.string().min(1).max(60).optional(),
  isFavorite: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

const verifyAccountSchema = z.object({
  accountNumber: z.string().min(6).max(20),
  bankCode: z.string().min(1).max(20),
});

router.use(authenticate);

router.get('/', beneficiariesController.list);
router.post('/', validate(createBeneficiarySchema), beneficiariesController.create);
router.post('/verify', validate(verifyAccountSchema), beneficiariesController.verifyAccount);
router.get('/:id', beneficiariesController.get);
router.patch('/:id', validate(updateBeneficiarySchema), beneficiariesController.update);
router.delete('/:id', beneficiariesController.remove);

export { router as beneficiariesRouter };
