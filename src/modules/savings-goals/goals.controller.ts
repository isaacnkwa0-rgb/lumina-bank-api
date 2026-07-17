import { Request, Response, NextFunction } from 'express';
import { goalsService } from './goals.service';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class GoalsController {
  async getGoals(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await goalsService.getGoals(userId);
      sendSuccess(res, data, 'Goals retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      const data = await goalsService.getGoal(id, userId);
      sendSuccess(res, data, 'Goal retrieved');
    } catch (err) {
      next(err);
    }
  }

  async createGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await goalsService.createGoal(userId, req.body);
      sendCreated(res, data, 'Goal created');
    } catch (err) {
      next(err);
    }
  }

  async updateGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      const data = await goalsService.updateGoal(id, userId, req.body);
      sendSuccess(res, data, 'Goal updated');
    } catch (err) {
      next(err);
    }
  }

  async deleteGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      const data = await goalsService.deleteGoal(id, userId);
      sendSuccess(res, data, 'Goal deleted');
    } catch (err) {
      next(err);
    }
  }

  async contribute(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      const data = await goalsService.contribute(id, userId, req.body);
      sendSuccess(res, data, 'Contribution successful');
    } catch (err) {
      next(err);
    }
  }

  async withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      const data = await goalsService.withdraw(id, userId, req.body);
      sendSuccess(res, data, 'Withdrawal successful');
    } catch (err) {
      next(err);
    }
  }
}

export default new GoalsController();
