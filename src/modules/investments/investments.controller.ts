import { Request, Response, NextFunction } from 'express';
import { investmentsService } from './investments.service';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class InvestmentsController {
  async getPortfolio(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await investmentsService.getPortfolio(userId);
      sendSuccess(res, data, 'Portfolio retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getHoldings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await investmentsService.getHoldings(userId);
      sendSuccess(res, data, 'Holdings retrieved');
    } catch (err) {
      next(err);
    }
  }

  async buy(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await investmentsService.buy(userId, req.body);
      sendCreated(res, data, 'Purchase successful');
    } catch (err) {
      next(err);
    }
  }

  async sell(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await investmentsService.sell(userId, req.body);
      sendSuccess(res, data, 'Sale successful');
    } catch (err) {
      next(err);
    }
  }

  async getPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const period = (req.query.period as string) ?? '1M';
      const data = await investmentsService.getPerformance(userId, period);
      sendSuccess(res, data, 'Performance data retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getWatchlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await investmentsService.getWatchlist(userId);
      sendSuccess(res, data, 'Watchlist retrieved');
    } catch (err) {
      next(err);
    }
  }

  async addToWatchlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await investmentsService.addToWatchlist(userId, req.body);
      sendCreated(res, data, 'Added to watchlist');
    } catch (err) {
      next(err);
    }
  }

  async removeFromWatchlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const ticker = req.params.ticker as string;
      const data = await investmentsService.removeFromWatchlist(userId, ticker);
      sendSuccess(res, data, 'Removed from watchlist');
    } catch (err) {
      next(err);
    }
  }

  async getMarketQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const ticker = req.query.ticker as string;
      if (!ticker) {
        res.status(400).json({ message: 'ticker query param required' });
        return;
      }
      const data = await investmentsService.getMarketQuote(ticker);
      sendSuccess(res, data, 'Quote retrieved');
    } catch (err) {
      next(err);
    }
  }

  async searchAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const query = (req.query.q as string) ?? '';
      const data = await investmentsService.searchAssets(query);
      sendSuccess(res, data, 'Search results');
    } catch (err) {
      next(err);
    }
  }
}

export default new InvestmentsController();
