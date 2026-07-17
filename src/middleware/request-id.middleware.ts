import { Request, Response, NextFunction } from 'express';
import { generateRequestId } from '../shared/utils/transaction-ref';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.requestId = generateRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
