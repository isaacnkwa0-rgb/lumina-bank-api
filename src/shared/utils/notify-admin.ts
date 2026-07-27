import { prisma } from '../../config/database';
import { mailService } from '../services/mail.service';
import { env } from '../../config/env';
import { AdminNotificationType } from '@prisma/client';

type AdminAlertPayload =
  | { type: 'NEW_REGISTRATION'; firstName: string; lastName: string; email: string; accountType?: string }
  | { type: 'KYC_SUBMITTED'; firstName: string; lastName: string; email: string; userId: string }
  | { type: 'LOAN_APPLICATION'; firstName: string; lastName: string; email: string; loanType: string; amount: number; termMonths: number; loanId: string }
  | { type: 'DISPUTE_FILED'; firstName: string; lastName: string; email: string; subject: string; description: string; disputeId: string }
  | { type: 'INSURANCE_QUOTE'; firstName: string; lastName: string; email: string; insuranceType: string; premium: number; quoteId: string }
  | { type: 'CRYPTO_ORDER'; firstName: string; lastName: string; email: string; coin: string; amountGbp: number; reference: string };

function buildRecord(payload: AdminAlertPayload): { type: AdminNotificationType; title: string; message: string; metadata: object } {
  const { type } = payload;

  if (type === 'NEW_REGISTRATION') {
    return {
      type: AdminNotificationType.NEW_REGISTRATION,
      title: `New registration: ${payload.firstName} ${payload.lastName}`,
      message: `${payload.email} registered${payload.accountType ? ` (${payload.accountType})` : ''}.`,
      metadata: { email: payload.email, accountType: payload.accountType },
    };
  }
  if (type === 'KYC_SUBMITTED') {
    return {
      type: AdminNotificationType.KYC_SUBMITTED,
      title: `KYC submitted: ${payload.firstName} ${payload.lastName}`,
      message: `${payload.email} submitted KYC documents and is awaiting verification.`,
      metadata: { userId: payload.userId, email: payload.email },
    };
  }
  if (type === 'LOAN_APPLICATION') {
    const loanLabel = payload.loanType.charAt(0).toUpperCase() + payload.loanType.slice(1).toLowerCase();
    return {
      type: AdminNotificationType.LOAN_APPLICATION,
      title: `Loan application: £${payload.amount.toLocaleString()} ${loanLabel} loan`,
      message: `${payload.firstName} ${payload.lastName} (${payload.email}) applied for a £${payload.amount.toLocaleString()} ${loanLabel} loan over ${payload.termMonths} months.`,
      metadata: { loanId: payload.loanId, email: payload.email, amount: payload.amount, loanType: payload.loanType, termMonths: payload.termMonths },
    };
  }
  if (type === 'DISPUTE_FILED') {
    return {
      type: AdminNotificationType.DISPUTE_FILED,
      title: `New dispute: "${payload.subject}"`,
      message: `${payload.firstName} ${payload.lastName} (${payload.email}) filed a dispute.`,
      metadata: { disputeId: payload.disputeId, email: payload.email, subject: payload.subject },
    };
  }
  if (type === 'INSURANCE_QUOTE') {
    const insuranceLabel = payload.insuranceType.charAt(0).toUpperCase() + payload.insuranceType.slice(1).toLowerCase();
    return {
      type: AdminNotificationType.INSURANCE_QUOTE,
      title: `Insurance quote: ${insuranceLabel} from ${payload.firstName} ${payload.lastName}`,
      message: `${payload.email} requested a ${insuranceLabel} insurance quote at £${payload.premium.toFixed(2)}/month.`,
      metadata: { quoteId: payload.quoteId, email: payload.email, insuranceType: payload.insuranceType, premium: payload.premium },
    };
  }
  // CRYPTO_ORDER
  return {
    type: AdminNotificationType.CRYPTO_ORDER,
    title: `Crypto order: £${payload.amountGbp.toFixed(2)} ${payload.coin}`,
    message: `${payload.firstName} ${payload.lastName} (${payload.email}) submitted a crypto purchase order.`,
    metadata: { reference: payload.reference, email: payload.email, coin: payload.coin, amountGbp: payload.amountGbp },
  };
}

export function notifyAdmin(payload: AdminAlertPayload): void {
  const record = buildRecord(payload);

  prisma.adminNotification.create({ data: record }).catch(() => {});

  const { firstName, lastName, email } = payload as { firstName: string; lastName: string; email: string };

  if (payload.type === 'NEW_REGISTRATION') {
    mailService.sendNewRegistrationAlert(env.ADMIN_EMAIL, { firstName, lastName, email, accountType: payload.accountType }).catch(() => {});
  } else if (payload.type === 'KYC_SUBMITTED') {
    mailService.sendKycSubmittedAlert(env.ADMIN_EMAIL, { firstName, lastName, email, userId: payload.userId }).catch(() => {});
  } else if (payload.type === 'LOAN_APPLICATION') {
    mailService.sendNewLoanApplicationAlert(env.ADMIN_EMAIL, { firstName, lastName, email, loanType: payload.loanType, amount: payload.amount, termMonths: payload.termMonths, loanId: payload.loanId }).catch(() => {});
  } else if (payload.type === 'DISPUTE_FILED') {
    mailService.sendNewDisputeAlert(env.ADMIN_EMAIL, { firstName, lastName, email, subject: payload.subject, description: payload.description, disputeId: payload.disputeId }).catch(() => {});
  } else if (payload.type === 'INSURANCE_QUOTE') {
    mailService.sendNewInsuranceQuoteAlert(env.ADMIN_EMAIL, { firstName, lastName, email, insuranceType: payload.insuranceType, premium: payload.premium, quoteId: payload.quoteId }).catch(() => {});
  } else if (payload.type === 'CRYPTO_ORDER') {
    mailService.sendNewCryptoOrderAlert(env.ADMIN_EMAIL, { firstName, lastName, email, coin: payload.coin, amountGbp: payload.amountGbp, reference: payload.reference }).catch(() => {});
  }
}
