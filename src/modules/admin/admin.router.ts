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
router.patch('/disputes/:id/resolve', adminController.resolveDispute.bind(adminController));

export default router;
