import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../config/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    http: vi.fn(),
  },
}));

import { globalErrorHandler, AppError } from '../middleware/error.middleware';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
  };
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.setHeader = vi.fn().mockImplementation((name: string, value: string) => {
    res.headers[name] = value;
    return res;
  });
  return res;
}

function makeMockReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    path: '/api/v1/auth/login',
    method: 'POST',
    requestId: 'req_test123',
    ...overrides,
  };
}

const next: NextFunction = vi.fn();

/** Prisma v6: PrismaClientInitializationError with errorCode === undefined */
function makePrismaInitError(msg = "Can't reach database server at host:5432"): Error {
  const err = new Error(msg);
  err.name = 'PrismaClientInitializationError';
  (err as any).errorCode = undefined;
  return err;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('globalErrorHandler', () => {
  // ── PrismaClientInitializationError ──────────────────────────────────────
  describe('PrismaClientInitializationError → 503 SYS_WARMING (Prisma v6 fix)', () => {
    it('returns HTTP 503 when err.name is PrismaClientInitializationError and errorCode is undefined', () => {
      const res = makeMockRes();
      const req = makeMockReq();

      globalErrorHandler(makePrismaInitError(), req as Request, res as Response, next);

      expect(res.statusCode).toBe(503);
    });

    it('sets error.code to SYS_WARMING in the response body', () => {
      const res = makeMockRes();
      const req = makeMockReq();

      globalErrorHandler(makePrismaInitError(), req as Request, res as Response, next);

      expect((res.body as any).error.code).toBe('SYS_WARMING');
      expect((res.body as any).success).toBe(false);
    });

    it('sets the Retry-After response header to "10"', () => {
      const res = makeMockRes();
      const req = makeMockReq();

      globalErrorHandler(makePrismaInitError(), req as Request, res as Response, next);

      expect(res.headers['Retry-After']).toBe('10');
    });

    it('includes retryAfter: 10 inside the error body', () => {
      const res = makeMockRes();
      const req = makeMockReq();

      globalErrorHandler(makePrismaInitError(), req as Request, res as Response, next);

      expect((res.body as any).error.retryAfter).toBe(10);
    });
  });

  // ── P1xxx errors via errorCode (Prisma < v6 path) ────────────────────────
  describe('P1xxx errors via errorCode → 503 SYS_WARMING', () => {
    it('returns 503 when err.errorCode starts with "P1"', () => {
      const res = makeMockRes();
      const err = new Error('Connection refused');
      (err as any).errorCode = 'P1001';

      globalErrorHandler(err, makeMockReq() as Request, res as Response, next);

      expect(res.statusCode).toBe(503);
      expect((res.body as any).error.code).toBe('SYS_WARMING');
    });

    it('sets Retry-After: 10 for errorCode P1xxx errors', () => {
      const res = makeMockRes();
      const err = new Error('Connection refused');
      (err as any).errorCode = 'P1002';

      globalErrorHandler(err, makeMockReq() as Request, res as Response, next);

      expect(res.headers['Retry-After']).toBe('10');
    });
  });

  // ── P1xxx errors via code property ───────────────────────────────────────
  describe('P1xxx errors via code property → 503 SYS_WARMING', () => {
    it('returns 503 when err.code starts with "P1"', () => {
      const res = makeMockRes();
      const err = new Error('DB unreachable');
      (err as any).code = 'P1001';

      globalErrorHandler(err, makeMockReq() as Request, res as Response, next);

      expect(res.statusCode).toBe(503);
      expect((res.body as any).error.code).toBe('SYS_WARMING');
    });
  });

  // ── Other Prisma errors remain unchanged ─────────────────────────────────
  describe('P2002 unique-constraint → 409 (existing behaviour preserved)', () => {
    it('returns 409 with code ACCT_004 for a P2002 error', () => {
      const res = makeMockRes();
      const err = new Error('Unique constraint failed on email');
      (err as any).code = 'P2002';

      globalErrorHandler(err, makeMockReq() as Request, res as Response, next);

      expect(res.statusCode).toBe(409);
      expect((res.body as any).error.code).toBe('ACCT_004');
    });

    it('does NOT set a Retry-After header for P2002', () => {
      const res = makeMockRes();
      const err = new Error('Unique constraint');
      (err as any).code = 'P2002';

      globalErrorHandler(err, makeMockReq() as Request, res as Response, next);

      expect(res.headers['Retry-After']).toBeUndefined();
    });
  });

  // ── AppError passthrough ──────────────────────────────────────────────────
  describe('AppError → uses its own statusCode and code', () => {
    it('returns the AppError statusCode and code (401 AUTH_001)', () => {
      const res = makeMockRes();

      globalErrorHandler(
        new AppError('Invalid credentials', 401, 'AUTH_001'),
        makeMockReq() as Request,
        res as Response,
        next,
      );

      expect(res.statusCode).toBe(401);
      expect((res.body as any).error.code).toBe('AUTH_001');
      expect((res.body as any).error.message).toBe('Invalid credentials');
    });

    it('returns 403 for a suspended-account AppError', () => {
      const res = makeMockRes();

      globalErrorHandler(
        new AppError('Account suspended', 403, 'AUTH_002'),
        makeMockReq() as Request,
        res as Response,
        next,
      );

      expect(res.statusCode).toBe(403);
      expect((res.body as any).error.code).toBe('AUTH_002');
    });

    it('does NOT set a Retry-After header for AppErrors', () => {
      const res = makeMockRes();

      globalErrorHandler(
        new AppError('Invalid credentials', 401, 'AUTH_001'),
        makeMockReq() as Request,
        res as Response,
        next,
      );

      expect(res.headers['Retry-After']).toBeUndefined();
    });
  });

  // ── Unknown / unhandled errors ────────────────────────────────────────────
  describe('unhandled errors → 500 SYS_001', () => {
    it('returns 500 with code SYS_001 for an unknown error', () => {
      const res = makeMockRes();

      globalErrorHandler(
        new Error('Something unexpected'),
        makeMockReq() as Request,
        res as Response,
        next,
      );

      expect(res.statusCode).toBe(500);
      expect((res.body as any).error.code).toBe('SYS_001');
    });

    it('does NOT set a Retry-After header for generic errors', () => {
      const res = makeMockRes();

      globalErrorHandler(
        new Error('Something unexpected'),
        makeMockReq() as Request,
        res as Response,
        next,
      );

      expect(res.headers['Retry-After']).toBeUndefined();
    });
  });
});
