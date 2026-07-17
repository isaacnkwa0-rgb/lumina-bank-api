import { Request, Response, NextFunction } from 'express';
import { cardsService } from './cards.service';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class CardsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const cards = await cardsService.getCards(req.user!.id);
      sendSuccess(res, cards, 'Cards retrieved');
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const card = await cardsService.getCard((req.params.id as string), req.user!.id);
      sendSuccess(res, card, 'Card retrieved');
    } catch (err) {
      next(err);
    }
  }

  async issue(req: Request, res: Response, next: NextFunction) {
    try {
      const card = await cardsService.issueCard(req.user!.id, req.body);
      sendCreated(res, card, 'Card issued successfully');
    } catch (err) {
      next(err);
    }
  }

  async freeze(req: Request, res: Response, next: NextFunction) {
    try {
      const card = await cardsService.freeze((req.params.id as string), req.user!.id);
      sendSuccess(res, card, 'Card frozen');
    } catch (err) {
      next(err);
    }
  }

  async unfreeze(req: Request, res: Response, next: NextFunction) {
    try {
      const card = await cardsService.unfreeze((req.params.id as string), req.user!.id);
      sendSuccess(res, card, 'Card unfrozen');
    } catch (err) {
      next(err);
    }
  }

  async updateLimits(req: Request, res: Response, next: NextFunction) {
    try {
      const card = await cardsService.updateLimits((req.params.id as string), req.user!.id, req.body);
      sendSuccess(res, card, 'Spending limits updated');
    } catch (err) {
      next(err);
    }
  }

  async updateControls(req: Request, res: Response, next: NextFunction) {
    try {
      const card = await cardsService.updateControls((req.params.id as string), req.user!.id, req.body);
      sendSuccess(res, card, 'Card controls updated');
    } catch (err) {
      next(err);
    }
  }

  async issueVirtual(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId } = req.body;
      const card = await cardsService.issueVirtual(req.user!.id, accountId);
      sendCreated(res, card, 'Virtual card issued successfully');
    } catch (err) {
      next(err);
    }
  }

  async replace(req: Request, res: Response, next: NextFunction) {
    try {
      const card = await cardsService.replace((req.params.id as string), req.user!.id);
      sendCreated(res, card, 'Card replaced successfully');
    } catch (err) {
      next(err);
    }
  }

  async reportLost(req: Request, res: Response, next: NextFunction) {
    try {
      const card = await cardsService.reportLost((req.params.id as string), req.user!.id);
      sendSuccess(res, card, 'Card reported as lost and blocked');
    } catch (err) {
      next(err);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, dateFrom, dateTo } = req.query as any;
      const result = await cardsService.getCardTransactions((req.params.id as string), req.user!.id, {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        dateFrom,
        dateTo,
      });
      sendSuccess(res, result.transactions, 'Card transactions retrieved', 200, result.meta);
    } catch (err) {
      next(err);
    }
  }
}

export const cardsController = new CardsController();
