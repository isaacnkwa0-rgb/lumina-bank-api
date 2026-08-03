import { Request, Response, NextFunction } from 'express';
import { depositsService } from './deposits.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class DepositsController {
  async initiateBankTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, amount, senderName, senderBank } = req.body;
      const data = await depositsService.initiateBankTransfer(req.user!.id, { accountId, amount, senderName, senderBank });
      sendSuccess(res, data, 'Bank transfer deposit initiated. Please transfer to the provided bank details.', 201);
    } catch (err) { next(err); }
  }

  async initiateCryptoDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, coin, amountGbp, priceGbp } = req.body;
      const data = await depositsService.initiateCryptoDeposit(req.user!.id, { accountId, coin, amountGbp, priceGbp });
      sendSuccess(res, data, 'Crypto deposit initiated. Please send the crypto to the provided wallet address.', 201);
    } catch (err) { next(err); }
  }

  async listDeposits(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await depositsService.listDeposits(req.user!.id);
      sendSuccess(res, data, 'Deposits retrieved');
    } catch (err) { next(err); }
  }

  async getDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await depositsService.getDeposit(req.params.id as string, req.user!.id);
      sendSuccess(res, data, 'Deposit retrieved');
    } catch (err) { next(err); }
  }

  async getSupportedCoins(req: Request, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, depositsService.getSupportedCoins(), 'Supported coins retrieved');
    } catch (err) { next(err); }
  }
}

export default new DepositsController();
