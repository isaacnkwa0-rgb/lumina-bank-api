import { Request, Response, NextFunction } from 'express';
import { accountsService } from './accounts.service';
import { sendSuccess, sendCreated, sendError, ErrorCodes } from '../../shared/utils/api-response';

export class AccountsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await accountsService.getAccounts(req.user!.id);
      sendSuccess(res, accounts, 'Accounts retrieved');
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await accountsService.getAccount((req.params.id as string), req.user!.id);
      sendSuccess(res, account, 'Account retrieved');
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await accountsService.createAccount(req.user!.id, req.body);
      sendCreated(res, account, 'Account opened successfully');
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.statusCode === 409) {
        sendError(res, ErrorCodes.ACCT_004, err?.message || 'An account of this type already exists', 409, undefined, req.requestId);
        return;
      }
      next(err);
    }
  }

  async setDefault(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await accountsService.setDefault((req.params.id as string), req.user!.id);
      sendSuccess(res, account, 'Default account updated');
    } catch (err) {
      next(err);
    }
  }

  async freeze(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await accountsService.freeze((req.params.id as string), req.user!.id);
      sendSuccess(res, account, 'Account frozen');
    } catch (err) {
      next(err);
    }
  }

  async unfreeze(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await accountsService.unfreeze((req.params.id as string), req.user!.id);
      sendSuccess(res, account, 'Account unfrozen');
    } catch (err) {
      next(err);
    }
  }

  async closeAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await accountsService.closeAccount((req.params.id as string), req.user!.id);
      sendSuccess(res, account, 'Account closed');
    } catch (err) {
      next(err);
    }
  }

  async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const balance = await accountsService.getBalance((req.params.id as string), req.user!.id);
      sendSuccess(res, balance, 'Balance retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const { dateFrom, dateTo, page, limit } = req.query as any;
      const result = await accountsService.getStatement(
        (req.params.id as string),
        req.user!.id,
        dateFrom,
        dateTo,
        Number(page) || 1,
        Number(limit) || 50
      );
      sendSuccess(res, result.transactions, 'Statement retrieved', 200, result.meta);
    } catch (err) {
      next(err);
    }
  }
}

export const accountsController = new AccountsController();
