import { Router } from 'express';
import { adminService } from './admin.service';
import adminController from './admin.controller';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/users', adminController.getUsers.bind(adminController));
router.get('/users/:id', adminController.getUser.bind(adminController));
router.patch('/users/:id/suspend', adminController.suspendUser.bind(adminController));
router.patch('/users/:id/activate', adminController.activateUser.bind(adminController));
router.patch('/kyc/:userId/verify', adminController.approveKyc.bind(adminController));
router.patch('/kyc/:userId/reject', adminController.rejectKyc.bind(adminController));
router.get('/audit-logs', adminController.getAuditLogs.bind(adminController));
router.get('/stats', adminController.getStats.bind(adminController));
router.get('/transfers', adminController.getTransfers.bind(adminController));
router.patch('/transfers/:id/approve', adminController.approveTransfer.bind(adminController));
router.patch('/transfers/:id/reject', adminController.rejectTransfer.bind(adminController));

// Loans
router.get('/loans', adminController.getLoans.bind(adminController));
router.patch('/loans/:id/approve', adminController.approveLoan.bind(adminController));
router.patch('/loans/:id/reject', adminController.rejectLoan.bind(adminController));

// Disputes
router.get('/disputes', adminController.getDisputes.bind(adminController));
router.patch('/disputes/:id/review', adminController.reviewDispute.bind(adminController));
router.patch('/disputes/:id/resolve', adminController.resolveDispute.bind(adminController));
router.patch('/disputes/:id/reject', adminController.rejectDispute.bind(adminController));

// Insurance
router.get('/insurance', adminController.getInsuranceQuotes.bind(adminController));
router.patch('/insurance/:id/process', adminController.processInsuranceQuote.bind(adminController));

// Cards
router.get('/cards', adminController.getAdminCards.bind(adminController));
router.patch('/cards/:id/block', adminController.blockCard.bind(adminController));
router.patch('/cards/:id/unblock', adminController.unblockCard.bind(adminController));

// Transactions
router.get('/transactions', adminController.getAdminTransactions.bind(adminController));

// Exchange Rates
router.get('/rates', adminController.getAdminRates.bind(adminController));
router.post('/rates/refresh', adminController.refreshAdminRates.bind(adminController));

// Investments
router.get('/investments', adminController.getAdminInvestments.bind(adminController));

// Savings Goals
router.get('/goals', adminController.getAdminGoals.bind(adminController));

// User tier / delete / lockout / email
router.patch('/users/:id/tier', adminController.changeUserTier.bind(adminController));
router.delete('/users/:id', adminController.deleteUser.bind(adminController));
router.patch('/users/:id/reset-lockout', adminController.resetLockout.bind(adminController));
router.patch('/users/:id/verify-email', adminController.verifyUserEmail.bind(adminController));

// Crypto orders
router.get('/crypto/orders', adminController.getAdminCryptoOrders.bind(adminController));
router.patch('/crypto/orders/:id/approve', adminController.approveCryptoOrder.bind(adminController));
router.patch('/crypto/orders/:id/reject', adminController.rejectCryptoOrder.bind(adminController));

// KYC management
router.get('/kyc', adminController.getKycSubmissions.bind(adminController));

// Account management
router.get('/users/:userId/accounts', adminController.getUserAccounts.bind(adminController));
router.patch('/accounts/:accountId/freeze', adminController.freezeAccount.bind(adminController));
router.patch('/accounts/:accountId/unfreeze', adminController.unfreezeAccount.bind(adminController));
router.patch('/accounts/:accountId/close', adminController.closeAccount.bind(adminController));

// Support tickets
router.get('/support/tickets', adminController.getSupportTickets.bind(adminController));
router.get('/support/tickets/:id', adminController.getSupportTicket.bind(adminController));
router.post('/support/tickets/:id/reply', adminController.replyToTicket.bind(adminController));
router.patch('/support/tickets/:id/resolve', adminController.resolveSupportTicket.bind(adminController));

export default router;
