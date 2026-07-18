import { Request, Response, NextFunction } from 'express';
import { cryptoService } from './crypto.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class CryptoController {
  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, coin, coinId, network, walletAddress, amountGbp, priceGbp } = req.body;
      const data = await cryptoService.createOrder(req.user!.id, {
        accountId, coin, coinId, network, walletAddress, amountGbp, priceGbp,
      });
      sendSuccess(res, data, 'Crypto order submitted', 201);
    } catch (err) { next(err); }
  }

  async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await cryptoService.listOrders(req.user!.id);
      sendSuccess(res, data, 'Orders retrieved');
    } catch (err) { next(err); }
  }

  async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await cryptoService.getOrder(req.params.id as string, req.user!.id);
      sendSuccess(res, data, 'Order retrieved');
    } catch (err) { next(err); }
  }
}

export default new CryptoController();
