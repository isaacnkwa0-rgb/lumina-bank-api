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

  async reviewDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.reviewDispute(req.params.id as string);
      sendSuccess(res, data, 'Dispute moved to review');
    } catch (err) { next(err); }
  }

  async rejectDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      if (!reason) { res.status(400).json({ message: 'Reason is required' }); return; }
      const data = await adminService.rejectDispute(req.params.id as string, reason);
      sendSuccess(res, data, 'Dispute rejected');
    } catch (err) { next(err); }
  }

  // ── Insurance ────────────────────────────────────────────────────────────────

  async getInsuranceQuotes(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getInsuranceQuotes(req.query.status as string | undefined);
      sendSuccess(res, data, 'Insurance quotes retrieved');
    } catch (err) { next(err); }
  }

  async processInsuranceQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, premium, notes } = req.body;
      if (!status) { res.status(400).json({ message: 'Status is required' }); return; }
      const data = await adminService.processInsuranceQuote(req.params.id as string, status, premium ? Number(premium) : undefined, notes);
      sendSuccess(res, data, 'Insurance quote processed');
    } catch (err) { next(err); }
  }

  // ── Cards ────────────────────────────────────────────────────────────────────

  async getAdminCards(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, page, limit } = req.query as any;
      const data = await adminService.getAdminCards({ status, page: Number(page) || 1, limit: Number(limit) || 20 });
      sendSuccess(res, data.cards, 'Cards retrieved', 200, data.meta);
    } catch (err) { next(err); }
  }

  async blockCard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.blockCard(req.params.id as string);
      sendSuccess(res, data, 'Card blocked');
    } catch (err) { next(err); }
  }

  async unblockCard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.unblockCard(req.params.id as string);
      sendSuccess(res, data, 'Card unblocked');
    } catch (err) { next(err); }
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  async getAdminTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, status, type } = req.query as any;
      const data = await adminService.getAdminTransactions({ page: Number(page) || 1, limit: Number(limit) || 30, status, type });
      sendSuccess(res, data.transactions, 'Transactions retrieved', 200, data.meta);
    } catch (err) { next(err); }
  }

  // ── Rates ────────────────────────────────────────────────────────────────────

  async getAdminRates(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getAdminRates();
      sendSuccess(res, data, 'Rates retrieved');
    } catch (err) { next(err); }
  }

  async refreshAdminRates(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.refreshAdminRates();
      sendSuccess(res, data, 'Rates refreshed');
    } catch (err) { next(err); }
  }

  // ── Investments ──────────────────────────────────────────────────────────────

  async getAdminInvestments(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getAdminInvestments();
      sendSuccess(res, data, 'Investments retrieved');
    } catch (err) { next(err); }
  }

  // ── Savings Goals ─────────────────────────────────────────────────────────────

  async getAdminGoals(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getAdminGoals(req.query.status as string | undefined);
      sendSuccess(res, data, 'Goals retrieved');
    } catch (err) { next(err); }
  }

  // ── Loans with type filter ───────────────────────────────────────────────────

  async getLoansByType(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getLoansByType(req.query.status as string | undefined, req.query.type as string | undefined);
      sendSuccess(res, data, 'Loans retrieved');
    } catch (err) { next(err); }
  }

  // ── User tier / delete / lockout / email ─────────────────────────────────────

  async changeUserTier(req: Request, res: Response, next: NextFunction) {
    try {
      const { tier } = req.body;
      if (!tier) { res.status(400).json({ message: 'Tier is required' }); return; }
      const data = await adminService.changeUserTier(req.params.id as string, tier);
      sendSuccess(res, data, 'User tier updated');
    } catch (err) { next(err); }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.deleteUser(req.params.id as string);
      sendSuccess(res, data, 'User deleted');
    } catch (err) { next(err); }
  }

  async resetLockout(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.resetLockout(req.params.id as string);
      sendSuccess(res, data, 'Account lockout reset');
    } catch (err) { next(err); }
  }

  async verifyUserEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.verifyUserEmail(req.params.id as string);
      sendSuccess(res, data, 'Email verified');
    } catch (err) { next(err); }
  }

  // ── Crypto Orders ─────────────────────────────────────────────────────────────

  async getAdminCryptoOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getAdminCryptoOrders(req.query.status as string | undefined);
      sendSuccess(res, data, 'Crypto orders retrieved');
    } catch (err) { next(err); }
  }

  async approveCryptoOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { notes } = req.body;
      const data = await adminService.approveCryptoOrder(req.params.id as string, notes);
      sendSuccess(res, data, 'Crypto order approved');
    } catch (err) { next(err); }
  }

  async rejectCryptoOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body;
      if (!reason) { res.status(400).json({ message: 'Reason is required' }); return; }
      const data = await adminService.rejectCryptoOrder(req.params.id as string, reason);
      sendSuccess(res, data, 'Crypto order rejected and refunded');
    } catch (err) { next(err); }
  }

  // ── KYC management ───────────────────────────────────────────────────────────

  async getKycSubmissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.query;
      const data = await adminService.getKycSubmissions(status as string | undefined);
      sendSuccess(res, data, 'KYC submissions retrieved');
    } catch (err) { next(err); }
  }

  // ── Account management ────────────────────────────────────────────────────────

  async getUserAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getUserAccounts(req.params.userId as string);
      sendSuccess(res, data, 'Accounts retrieved');
    } catch (err) { next(err); }
  }

  async freezeAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.freezeAccount(req.params.accountId as string);
      sendSuccess(res, data, 'Account frozen');
    } catch (err) { next(err); }
  }

  async unfreezeAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.unfreezeAccount(req.params.accountId as string);
      sendSuccess(res, data, 'Account unfrozen');
    } catch (err) { next(err); }
  }

  async closeAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.closeAccount(req.params.accountId as string);
      sendSuccess(res, data, 'Account closed');
    } catch (err) { next(err); }
  }

  async getSupportTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const data = await adminService.getSupportTickets({ page, limit, status, search });
      sendSuccess(res, data, 'Support tickets retrieved');
    } catch (err) { next(err); }
  }

  async getSupportTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getSupportTicket(req.params.id as string);
      sendSuccess(res, data, 'Support ticket retrieved');
    } catch (err) { next(err); }
  }

  async replyToTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { body } = req.body as { body: string };
      const data = await adminService.replyToTicket(req.params.id as string, req.user!.id, body);
      sendSuccess(res, data, 'Reply sent', 201);
    } catch (err) { next(err); }
  }

  async resolveSupportTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.resolveSupportTicket(req.params.id as string);
      sendSuccess(res, data, 'Ticket resolved');
    } catch (err) { next(err); }
  }

  async fundAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, accountId } = req.params as { userId: string; accountId: string };
      const { amount, description } = req.body as { amount: number; description?: string };
      const data = await adminService.fundAccount(userId, accountId, Number(amount), description);
      sendSuccess(res, data, 'Account funded successfully');
    } catch (err) { next(err); }
  }

  async getAgents(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getAgents();
      sendSuccess(res, data, 'Agents retrieved');
    } catch (err) { next(err); }
  }

  async createAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.createAgent(req.body);
      sendSuccess(res, data, 'Agent created', 201);
    } catch (err) { next(err); }
  }

  async updateAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.updateAgent(req.params.id as string, req.body);
      sendSuccess(res, data, 'Agent updated');
    } catch (err) { next(err); }
  }

  async deleteAgent(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.deleteAgent(req.params.id as string);
      sendSuccess(res, data, 'Agent deleted');
    } catch (err) { next(err); }
  }
}

export default new AdminController();
