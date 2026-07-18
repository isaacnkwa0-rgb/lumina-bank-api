import { format } from 'date-fns';
import { randomBytes } from 'crypto';

export function generateTransactionReference(): string {
  const date = format(new Date(), 'yyyyMMdd');
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `LMN-${date}-${random}`;
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
}
