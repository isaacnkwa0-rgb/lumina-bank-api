import { prisma } from '../../config/database';
import { mailService } from '../services/mail.service';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AdminNotificationType } from '@prisma/client';

type AdminAlertPayload =
  | { type: 'NEW_REGISTRATION'; firstName: string; lastName: string; email: string; accountType?: string }
  | { type: 'KYC_SUBMITTED'; firstName: string; lastName: string; email: string; userId: string }
  | { type: 'LOAN_APPLICATION'; firstName: string; lastName: string; email: string; loanType: string; amount: number; termMonths: number; loanId: string }
  | { type: 'DISPUTE_FILED'; firstName: string; lastName: string; email: string; subject: string; description: string; disputeId: string }
  | { type: 'INSURANCE_QUOTE'; firstName: string; lastName: string; email: string; insuranceType: string; premium: number; quoteId: string }
  | { type: 'CRYPTO_ORDER'; firstName: string; lastName: string; email: string; coin: string; amountGbp: number; reference: string }
  | { type: 'LARGE_TRANSFER'; firstName: string; lastName: string; email: string; amount: number; currency: string; recipient: string; transferId: string }
  | { type: 'INTERNATIONAL_TRANSFER'; firstName: string; lastName: string; email: string; amount: number; currency: string; recipient: string; toCountry: string; transferId: string }
  | { type: 'ACCOUNT_LOCKED'; firstName: string; lastName: string; email: string; lockDurationMinutes: number }
  | { type: 'PASSWORD_CHANGED'; firstName: string; lastName: string; email: string }
  | { type: 'SITE_VISITOR'; ip: string; country?: string; city?: string; isp?: string; browser?: string; device?: string; page?: string }
  | { type: 'NEW_SUPPORT_TICKET'; firstName: string; lastName: string; email: string; subject: string; firstMessage: string; ticketId: string }
  | { type: 'SUPPORT_MESSAGE'; firstName: string; lastName: string; email: string; subject: string; messageBody: string; ticketId: string }
  | { type: 'LARGE_DEPOSIT'; firstName: string; lastName: string; email: string; amount: number; currency: string; accountId: string }
  | { type: 'DEPOSIT_REQUEST'; firstName: string; lastName: string; email: string; method: string; amount: number; currency: string; reference: string; depositId: string };

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
  if (type === 'CRYPTO_ORDER') {
    return {
      type: AdminNotificationType.CRYPTO_ORDER,
      title: `Crypto order: £${payload.amountGbp.toFixed(2)} ${payload.coin}`,
      message: `${payload.firstName} ${payload.lastName} (${payload.email}) submitted a crypto purchase order.`,
      metadata: { reference: payload.reference, email: payload.email, coin: payload.coin, amountGbp: payload.amountGbp },
    };
  }
  if (type === 'LARGE_TRANSFER') {
    const sym = payload.currency === 'GBP' ? '£' : payload.currency === 'EUR' ? '€' : payload.currency === 'USD' ? '$' : `${payload.currency} `;
    return {
      type: AdminNotificationType.LARGE_TRANSFER,
      title: `Large transfer: ${sym}${payload.amount.toLocaleString()} to ${payload.recipient}`,
      message: `${payload.firstName} ${payload.lastName} (${payload.email}) sent ${sym}${payload.amount.toLocaleString()} domestically.`,
      metadata: { transferId: payload.transferId, email: payload.email, amount: payload.amount, currency: payload.currency, recipient: payload.recipient },
    };
  }
  if (type === 'INTERNATIONAL_TRANSFER') {
    const sym = payload.currency === 'GBP' ? '£' : payload.currency === 'EUR' ? '€' : payload.currency === 'USD' ? '$' : `${payload.currency} `;
    return {
      type: AdminNotificationType.INTERNATIONAL_TRANSFER,
      title: `International transfer: ${sym}${payload.amount.toLocaleString()} to ${payload.toCountry}`,
      message: `${payload.firstName} ${payload.lastName} (${payload.email}) sent ${sym}${payload.amount.toLocaleString()} internationally to ${payload.toCountry}.`,
      metadata: { transferId: payload.transferId, email: payload.email, amount: payload.amount, currency: payload.currency, recipient: payload.recipient, toCountry: payload.toCountry },
    };
  }
  if (type === 'ACCOUNT_LOCKED') {
    return {
      type: AdminNotificationType.ACCOUNT_LOCKED,
      title: `Account locked: ${payload.firstName} ${payload.lastName}`,
      message: `${payload.email} account was locked for ${payload.lockDurationMinutes} minutes after repeated failed login attempts.`,
      metadata: { email: payload.email, lockDurationMinutes: payload.lockDurationMinutes },
    };
  }
  if (type === 'PASSWORD_CHANGED') {
    return {
      type: AdminNotificationType.PASSWORD_CHANGED,
      title: `Password changed: ${payload.firstName} ${payload.lastName}`,
      message: `${payload.email} successfully changed their account password.`,
      metadata: { email: payload.email },
    };
  }
  if (type === 'SITE_VISITOR') {
    const location = [payload.city, payload.country].filter(Boolean).join(', ') || 'Unknown';
    return {
      type: AdminNotificationType.SITE_VISITOR,
      title: `New visitor from ${location}`,
      message: `New unique visitor: IP ${payload.ip} — ${location}${payload.isp ? ` (${payload.isp})` : ''}.`,
      metadata: { ip: payload.ip, country: payload.country, city: payload.city, isp: payload.isp, browser: payload.browser, device: payload.device },
    };
  }
  if (type === 'NEW_SUPPORT_TICKET') {
    return {
      type: AdminNotificationType.NEW_SUPPORT_TICKET,
      title: `New ticket: "${payload.subject}"`,
      message: `${payload.firstName} ${payload.lastName} (${payload.email}) opened a support ticket.`,
      metadata: { ticketId: payload.ticketId, email: payload.email, subject: payload.subject },
    };
  }
  if (type === 'SUPPORT_MESSAGE') {
    return {
      type: AdminNotificationType.SUPPORT_MESSAGE,
      title: `Customer replied: "${payload.subject}"`,
      message: `${payload.firstName} ${payload.lastName} (${payload.email}) sent a message on ticket "${payload.subject}".`,
      metadata: { ticketId: payload.ticketId, email: payload.email, subject: payload.subject },
    };
  }
  if (type === 'DEPOSIT_REQUEST') {
    const sym = payload.currency === 'GBP' ? '£' : payload.currency === 'EUR' ? '€' : payload.currency === 'USD' ? '$' : `${payload.currency} `;
    return {
      type: AdminNotificationType.DEPOSIT_REQUEST,
      title: `Deposit request: ${sym}${payload.amount.toLocaleString()} via ${payload.method}`,
      message: `${payload.firstName} ${payload.lastName} (${payload.email}) submitted a ${payload.method} deposit of ${sym}${payload.amount.toLocaleString()}.`,
      metadata: { depositId: payload.depositId, reference: payload.reference, method: payload.method, amount: payload.amount, currency: payload.currency },
    };
  }
  // LARGE_DEPOSIT
  const sym = payload.currency === 'GBP' ? '£' : payload.currency === 'EUR' ? '€' : payload.currency === 'USD' ? '$' : `${payload.currency} `;
  return {
    type: AdminNotificationType.LARGE_DEPOSIT,
    title: `Large deposit: ${sym}${payload.amount.toLocaleString()} credited to ${payload.firstName} ${payload.lastName}`,
    message: `${sym}${payload.amount.toLocaleString()} was deposited to ${payload.email}'s account by admin.`,
    metadata: { accountId: payload.accountId, email: payload.email, amount: payload.amount, currency: payload.currency },
  };
}

export function notifyAdmin(payload: AdminAlertPayload): void {
  const record = buildRecord(payload);

  // DB write — isolated so a failure never blocks the email
  prisma.adminNotification.create({ data: record }).catch((err: unknown) => {
    logger.warn('[notifyAdmin] DB write failed', { type: payload.type, error: String(err) });
  });

  const to = env.ADMIN_EMAIL;

  if (payload.type === 'NEW_REGISTRATION') {
    mailService.sendNewRegistrationAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, accountType: payload.accountType }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'KYC_SUBMITTED') {
    mailService.sendKycSubmittedAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, userId: payload.userId }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'LOAN_APPLICATION') {
    mailService.sendNewLoanApplicationAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, loanType: payload.loanType, amount: payload.amount, termMonths: payload.termMonths, loanId: payload.loanId }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'DISPUTE_FILED') {
    mailService.sendNewDisputeAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, subject: payload.subject, description: payload.description, disputeId: payload.disputeId }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'INSURANCE_QUOTE') {
    mailService.sendNewInsuranceQuoteAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, insuranceType: payload.insuranceType, premium: payload.premium, quoteId: payload.quoteId }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'CRYPTO_ORDER') {
    mailService.sendNewCryptoOrderAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, coin: payload.coin, amountGbp: payload.amountGbp, reference: payload.reference }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'LARGE_TRANSFER') {
    mailService.sendLargeTransferAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, amount: payload.amount, currency: payload.currency, recipient: payload.recipient, transferId: payload.transferId }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'INTERNATIONAL_TRANSFER') {
    mailService.sendInternationalTransferAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, amount: payload.amount, currency: payload.currency, recipient: payload.recipient, toCountry: payload.toCountry, transferId: payload.transferId }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'ACCOUNT_LOCKED') {
    mailService.sendAccountLockedAdminAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, lockDurationMinutes: payload.lockDurationMinutes }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'PASSWORD_CHANGED') {
    mailService.sendPasswordChangedAdminAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'SITE_VISITOR') {
    mailService.sendSiteVisitorAlert(to, { ip: payload.ip, country: payload.country, city: payload.city, isp: payload.isp, browser: payload.browser, device: payload.device, page: payload.page }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'NEW_SUPPORT_TICKET') {
    mailService.sendNewSupportTicketAlert(to, { ticketId: payload.ticketId, subject: payload.subject, customerName: `${payload.firstName} ${payload.lastName}`, customerEmail: payload.email, firstMessage: payload.firstMessage }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'SUPPORT_MESSAGE') {
    mailService.sendCustomerRepliedAlert(to, { ticketId: payload.ticketId, subject: payload.subject, customerName: `${payload.firstName} ${payload.lastName}`, messageBody: payload.messageBody }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'LARGE_DEPOSIT') {
    mailService.sendLargeDepositAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, amount: payload.amount, currency: payload.currency, accountId: payload.accountId }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  } else if (payload.type === 'DEPOSIT_REQUEST') {
    mailService.sendDepositRequestAlert(to, { firstName: payload.firstName, lastName: payload.lastName, email: payload.email, method: payload.method, amount: payload.amount, currency: payload.currency, reference: payload.reference, depositId: payload.depositId }).catch((err: unknown) => { logger.warn('[notifyAdmin] mail failed', { type: payload.type, error: String(err) }); });
  }
}
