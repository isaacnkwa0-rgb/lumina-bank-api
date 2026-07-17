import { Response } from 'express';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  cursor?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
  requestId?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
  meta?: PaginationMeta
): Response {
  const body: ApiSuccessResponse<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: Array<{ field: string; message: string }>,
  requestId?: string
): Response {
  const body: ApiErrorResponse = {
    success: false,
    error: { code, message },
    requestId,
  };
  if (details) body.error.details = details;
  return res.status(statusCode).json(body);
}

export const ErrorCodes = {
  // Auth
  AUTH_001: 'AUTH_001',
  AUTH_002: 'AUTH_002',
  AUTH_003: 'AUTH_003',
  AUTH_004: 'AUTH_004',
  AUTH_005: 'AUTH_005',
  AUTH_006: 'AUTH_006',
  // Account
  ACCT_001: 'ACCT_001',
  ACCT_002: 'ACCT_002',
  ACCT_003: 'ACCT_003',
  ACCT_004: 'ACCT_004',
  // Card
  CARD_001: 'CARD_001',
  CARD_002: 'CARD_002',
  CARD_003: 'CARD_003',
  CARD_004: 'CARD_004',
  // Transfer
  TRNF_001: 'TRNF_001',
  TRNF_002: 'TRNF_002',
  TRNF_003: 'TRNF_003',
  TRNF_004: 'TRNF_004',
  TRNF_005: 'TRNF_005',
  // KYC
  KYC_001: 'KYC_001',
  // Rates
  RATE_001: 'RATE_001',
  // Validation
  VAL_001: 'VAL_001',
  // System
  SYS_001: 'SYS_001',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
} as const;
