import { Router } from 'express';
import { z } from 'zod';
import disputesController from './disputes.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

const createSchema = z.object({
  subject:       z.string().min(3).max(120),
  description:   z.string().min(20).max(2000),
  transactionId: z.string().uuid().optional(),
});

router.use(authenticate);

router.get('/',           disputesController.getDisputes.bind(disputesController));
router.post('/', validate(createSchema), disputesController.createDispute.bind(disputesController));
router.get('/:id',        disputesController.getDispute.bind(disputesController));
router.patch('/:id/close', disputesController.closeDispute.bind(disputesController));

export default router;
