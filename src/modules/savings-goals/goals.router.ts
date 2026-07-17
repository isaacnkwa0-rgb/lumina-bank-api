import { Router } from 'express';
import goalsController from './goals.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', goalsController.getGoals.bind(goalsController));
router.post('/', goalsController.createGoal.bind(goalsController));
router.get('/:id', goalsController.getGoal.bind(goalsController));
router.patch('/:id', goalsController.updateGoal.bind(goalsController));
router.delete('/:id', goalsController.deleteGoal.bind(goalsController));
router.post('/:id/contribute', goalsController.contribute.bind(goalsController));
router.post('/:id/withdraw', goalsController.withdraw.bind(goalsController));

export default router;
