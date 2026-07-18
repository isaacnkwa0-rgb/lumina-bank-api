import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { sendError, ErrorCodes } from '../shared/utils/api-response';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code: string = ErrorCodes.SYS_001, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, ErrorCodes.NOT_FOUND, `Route ${req.method} ${req.path} not found`, 404);
}

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if ((err as any).code === 'P2002') {
    sendError(res, ErrorCodes.ACCT_004, 'An account of this type already exists', 409, undefined, req.requestId);
    return;
  }

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational error', { error: err.message, stack: err.stack });
    }
    sendError(res, err.code, err.message, err.statusCode, undefined, req.requestId);
    return;
  }

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.requestId,
  });

  sendError(
    res,
    ErrorCodes.SYS_001,
    'An internal server error occurred',
    500,
    undefined,
    req.requestId
  );
}
