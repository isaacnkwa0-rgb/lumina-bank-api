import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { env } from '../../config/env';

const ALGORITHM = 'aes-256-cbc';

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const key = Buffer.from(env.APP_ENCRYPTION_SECRET, 'utf8');
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(env.APP_ENCRYPTION_SECRET, 'utf8');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
