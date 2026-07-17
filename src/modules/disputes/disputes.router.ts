import { Router } from 'express';
import disputesController from './disputes.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', disputesController.createDispute.bind(disputesController));
router.get('/', disputesController.getDisputes.bind(disputesController));
router.get('/:id', disputesController.getDispute.bind(disputesController));

export default router;
