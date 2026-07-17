import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class AdminController {
  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const data = await adminService.getUsers({ page, limit, search, status });
      sendSuccess(res, data, 'Users retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await adminService.getUser(id);
      sendSuccess(res, data, 'User retrieved');
    } catch (err) {
      next(err);
    }
  }

  async suspendUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await adminService.suspendUser(id);
      sendSuccess(res, data, 'User suspended');
    } catch (err) {
      next(err);
    }
  }

  async activateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await adminService.activateUser(id);
      sendSuccess(res, data, 'User activated');
    } catch (err) {
      next(err);
    }
  }

  async approveKyc(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const data = await adminService.approveKyc(userId);
      sendSuccess(res, data, 'KYC approved');
    } catch (err) {
      next(err);
    }
  }

  async rejectKyc(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const { reason } = req.body;
      if (!reason) {
        res.status(400).json({ message: 'Rejection reason is required' });
        return;
      }
      const data = await adminService.rejectKyc(userId, reason);
      sendSuccess(res, data, 'KYC rejected');
    } catch (err) {
      next(err);
    }
  }

  async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const userId = req.query.userId as string | undefined;
      const action = req.query.action as string | undefined;
      const data = await adminService.getAuditLogs({ page, limit, userId, action });
      sendSuccess(res, data, 'Audit logs retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getStats();
      sendSuccess(res, data, 'Stats retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getTransfers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, type } = req.query as any;
      const data = await adminService.getTransfers({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        status,
        type,
      });
      sendSuccess(res, data.transfers, 'Transfers retrieved', 200, data.meta);
    } catch (err) { next(err); }
  }

  async approveTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.approveTransfer(req.params.id as string);
      sendSuccess(res, data, 'Transfer approved');
    } catch (err) { next(err); }
  }

  async rejectTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      const data = await adminService.rejectTransfer(req.params.id as string, reason);
      sendSuccess(res, data, 'Transfer rejected and refunded');
    } catch (err) { next(err); }
  }

  async getLoans(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getLoans(req.query.status as string | undefined);
      sendSuccess(res, data, 'Loans retrieved');
    } catch (err) { next(err); }
  }

  async approveLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.approveLoan(req.params.id as string);
      sendSuccess(res, data, 'Loan approved');
    } catch (err) { next(err); }
  }

  async rejectLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      const data = await adminService.rejectLoan(req.params.id as string, reason);
      sendSuccess(res, data, 'Loan rejected');
    } catch (err) { next(err); }
  }

  async getDisputes(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getDisputes(req.query.status as string | undefined);
      sendSuccess(res, data, 'Disputes retrieved');
    } catch (err) { next(err); }
  }

  async resolveDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const { resolution } = req.body;
      if (!resolution) { res.status(400).json({ message: 'Resolution is required' }); return; }
      const data = await adminService.resolveDispute(req.params.id as string, resolution);
      sendSuccess(res, data, 'Dispute resolved');
    } catch (err) { next(err); }
  }
}

export default new AdminController();
