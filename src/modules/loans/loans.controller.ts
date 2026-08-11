import { Request, Response, NextFunction } from 'express';
import { loansService } from './loans.service';
import { sendSuccess, sendCreated } from '../../shared/utils/api-response';

export class LoansController {
  async getLoans(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await loansService.getLoans(userId);
      sendSuccess(res, data, 'Loans retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      const data = await loansService.getLoan(id, userId);
      sendSuccess(res, data, 'Loan retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getAmortizationSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      const data = await loansService.getAmortizationSchedule(id, userId);
      sendSuccess(res, data, 'Amortization schedule retrieved');
    } catch (err) {
      next(err);
    }
  }

  async applyForLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await loansService.applyForLoan(userId, req.body);
      sendCreated(res, data, 'Loan application submitted');
    } catch (err) {
      next(err);
    }
  }

  async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      const data = await loansService.getPayments(id, userId);
      sendSuccess(res, data, 'Loan payments retrieved');
    } catch (err) {
      next(err);
    }
  }

  async repay(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const id = req.params.id as string;
      const { amount } = req.body;
      const data = await loansService.repay(id, userId, amount);
      sendSuccess(res, data, 'Payment successful');
    } catch (err) {
      next(err);
    }
  }

  async getEligibility(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await loansService.getEligibility(userId);
      sendSuccess(res, data, 'Eligibility retrieved');
    } catch (err) {
      next(err);
    }
  }

  async saveDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const { step, ...data } = req.body;
      const result = await loansService.saveApplicationDraft(req.params.id as string, req.user!.id, Number(step) || 2, data);
      sendSuccess(res, result, 'Draft saved');
    } catch (err) { next(err); }
  }

  async submitApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await loansService.submitApplication(req.params.id as string, req.user!.id);
      sendSuccess(res, result, 'Application submitted for review');
    } catch (err) { next(err); }
  }

  async getApplicationData(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await loansService.getApplicationData(req.params.id as string, req.user!.id);
      sendSuccess(res, result, 'Application data retrieved');
    } catch (err) { next(err); }
  }
}

export default new LoansController();
