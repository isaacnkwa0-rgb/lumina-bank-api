import { Router } from 'express';
import { adminService } from './admin.service';
import adminController from './admin.controller';
import { authenticate, requireAdmin, requireAgentOrAdmin } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// ── Admin-only routes ─────────────────────────────────────────────────────────
router.get('/users', requireAdmin, adminController.getUsers.bind(adminController));
router.get('/users/:id', requireAdmin, adminController.getUser.bind(adminController));
router.patch('/users/:id/suspend', requireAdmin, adminController.suspendUser.bind(adminController));
router.patch('/users/:id/activate', requireAdmin, adminController.activateUser.bind(adminController));
router.patch('/kyc/:userId/verify', requireAdmin, adminController.approveKyc.bind(adminController));
router.patch('/kyc/:userId/reject', requireAdmin, adminController.rejectKyc.bind(adminController));
router.get('/audit-logs', requireAdmin, adminController.getAuditLogs.bind(adminController));
router.get('/stats', requireAdmin, adminController.getStats.bind(adminController));
router.get('/transfers', requireAdmin, adminController.getTransfers.bind(adminController));
router.patch('/transfers/:id/approve', requireAdmin, adminController.approveTransfer.bind(adminController));
router.patch('/transfers/:id/reject', requireAdmin, adminController.rejectTransfer.bind(adminController));

// Loans
router.get('/loans', requireAdmin, adminController.getLoans.bind(adminController));
router.patch('/loans/:id/approve', requireAdmin, adminController.approveLoan.bind(adminController));
router.patch('/loans/:id/reject', requireAdmin, adminController.rejectLoan.bind(adminController));

// Disputes
router.get('/disputes', requireAdmin, adminController.getDisputes.bind(adminController));
router.patch('/disputes/:id/review', requireAdmin, adminController.reviewDispute.bind(adminController));
router.patch('/disputes/:id/resolve', requireAdmin, adminController.resolveDispute.bind(adminController));
router.patch('/disputes/:id/reject', requireAdmin, adminController.rejectDispute.bind(adminController));

// Insurance
router.get('/insurance', requireAdmin, adminController.getInsuranceQuotes.bind(adminController));
router.patch('/insurance/:id/process', requireAdmin, adminController.processInsuranceQuote.bind(adminController));

// Cards
router.get('/cards', requireAdmin, adminController.getAdminCards.bind(adminController));
router.patch('/cards/:id/block', requireAdmin, adminController.blockCard.bind(adminController));
router.patch('/cards/:id/unblock', requireAdmin, adminController.unblockCard.bind(adminController));

// Transactions
router.get('/transactions', requireAdmin, adminController.getAdminTransactions.bind(adminController));

// Exchange Rates
router.get('/rates', requireAdmin, adminController.getAdminRates.bind(adminController));
router.post('/rates/refresh', requireAdmin, adminController.refreshAdminRates.bind(adminController));

// Investments
router.get('/investments', requireAdmin, adminController.getAdminInvestments.bind(adminController));

// Savings Goals
router.get('/goals', requireAdmin, adminController.getAdminGoals.bind(adminController));

// User tier / delete / lockout / email
router.patch('/users/:id/tier', requireAdmin, adminController.changeUserTier.bind(adminController));
router.delete('/users/:id', requireAdmin, adminController.deleteUser.bind(adminController));
router.patch('/users/:id/reset-lockout', requireAdmin, adminController.resetLockout.bind(adminController));
router.patch('/users/:id/verify-email', requireAdmin, adminController.verifyUserEmail.bind(adminController));

// Crypto orders
router.get('/crypto/orders', requireAdmin, adminController.getAdminCryptoOrders.bind(adminController));
router.patch('/crypto/orders/:id/approve', requireAdmin, adminController.approveCryptoOrder.bind(adminController));
router.patch('/crypto/orders/:id/reject', requireAdmin, adminController.rejectCryptoOrder.bind(adminController));

// KYC management
router.get('/kyc', requireAdmin, adminController.getKycSubmissions.bind(adminController));

// Account management
router.get('/users/:userId/accounts', requireAdmin, adminController.getUserAccounts.bind(adminController));
router.patch('/accounts/:accountId/freeze', requireAdmin, adminController.freezeAccount.bind(adminController));
router.patch('/accounts/:accountId/unfreeze', requireAdmin, adminController.unfreezeAccount.bind(adminController));
router.patch('/accounts/:accountId/close', requireAdmin, adminController.closeAccount.bind(adminController));
router.post('/users/:userId/accounts/:accountId/fund', requireAdmin, adminController.fundAccount.bind(adminController));

// ── Support tickets (agents + admins) ─────────────────────────────────────────
router.get('/support/tickets', requireAgentOrAdmin, adminController.getSupportTickets.bind(adminController));
router.get('/support/tickets/:id', requireAgentOrAdmin, adminController.getSupportTicket.bind(adminController));
router.post('/support/tickets/:id/reply', requireAgentOrAdmin, adminController.replyToTicket.bind(adminController));
router.patch('/support/tickets/:id/resolve', requireAgentOrAdmin, adminController.resolveSupportTicket.bind(adminController));

// ── Support Agents management (admin-only) ────────────────────────────────────
router.get('/agents', requireAdmin, adminController.getAgents.bind(adminController));
router.post('/agents', requireAdmin, adminController.createAgent.bind(adminController));
router.patch('/agents/:id', requireAdmin, adminController.updateAgent.bind(adminController));
router.delete('/agents/:id', requireAdmin, adminController.deleteAgent.bind(adminController));

export default router;
