import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { sendError } from '../shared/utils/api-response';
import { Request, Response } from 'express';

function rateLimitHandler(_req: Request, res: Response): void {
  sendError(res, 'RATE_LIMIT', 'Too many requests, please try again later', 429);
}

function skipLocalhost(req: Request): boolean {
  if (env.NODE_ENV === 'production') return false;
  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipLocalhost,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: false,
  skip: skipLocalhost,
});

export const transferLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipLocalhost,
});
