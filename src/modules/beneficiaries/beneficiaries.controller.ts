import { Request, Response, NextFunction } from 'express';
import { beneficiariesService } from './beneficiaries.service';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class BeneficiariesController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const beneficiaries = await beneficiariesService.list(req.user!.id);
      sendSuccess(res, beneficiaries, 'Beneficiaries retrieved');
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const beneficiary = await beneficiariesService.get((req.params.id as string), req.user!.id);
      sendSuccess(res, beneficiary, 'Beneficiary retrieved');
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const beneficiary = await beneficiariesService.create(req.user!.id, req.body);
      sendCreated(res, beneficiary, 'Beneficiary added successfully');
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const beneficiary = await beneficiariesService.update((req.params.id as string), req.user!.id, req.body);
      sendSuccess(res, beneficiary, 'Beneficiary updated');
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await beneficiariesService.delete((req.params.id as string), req.user!.id);
      sendSuccess(res, null, 'Beneficiary deleted');
    } catch (err) {
      next(err);
    }
  }

  async verifyAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountNumber, bankCode } = req.body;
      const result = await beneficiariesService.verifyAccount(accountNumber, bankCode);
      sendSuccess(res, result, 'Account verified');
    } catch (err) {
      next(err);
    }
  }
}

export const beneficiariesController = new BeneficiariesController();
