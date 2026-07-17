import { format } from 'date-fns';

export function generateTransactionReference(): string {
  const date = format(new Date(), 'yyyyMMdd');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LMN-${date}-${random}`;
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
}
