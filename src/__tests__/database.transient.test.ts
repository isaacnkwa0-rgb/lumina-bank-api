import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks must be declared before the module under test is imported ────────────
// database.ts calls createPrisma() at module-load time; mock its deps so no
// real DB connection or env-var validation runs during the test suite.

vi.mock('../config/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
    NODE_ENV: 'test' as const,
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    constructor(_opts: unknown) {}
    $extends(_ext: unknown) {
      return this;
    }
  },
}));

vi.mock('../config/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    http: vi.fn(),
  },
}));

// ── Module under test ─────────────────────────────────────────────────────────
import { isTransientError, RETRY_DELAYS_MS } from '../config/database';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mimics Prisma v6 PrismaClientInitializationError where errorCode is undefined. */
function makePrismaInitError(msg = "Can't reach database server at host:5432"): Error {
  const err = new Error(msg);
  err.name = 'PrismaClientInitializationError';
  (err as any).errorCode = undefined; // Prisma v6 does not populate this field
  (err as any).clientVersion = '6.0.0';
  return err;
}

/**
 * Replicates the $allOperations retry loop from database.ts so tests can verify
 * behaviour without needing a real Prisma $extends context.
 * sleepFn replaces the real sleep() so the suite runs instantly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runRetryLoop<T>(operation: () => Promise<T>, sleepFn: (ms: number) => any): Promise<T> {
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (!isTransientError(err)) throw err;
      await sleepFn(RETRY_DELAYS_MS[attempt]);
    }
  }
  // Final attempt — mirrors the `return query(args)` line in database.ts
  return operation();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('isTransientError', () => {
  // ── 1. PrismaClientInitializationError (the fix under test) ─────────────────
  describe('PrismaClientInitializationError detection', () => {
    it('returns true when err.name is PrismaClientInitializationError and errorCode is undefined (Prisma v6)', () => {
      expect(isTransientError(makePrismaInitError())).toBe(true);
    });

    it('returns true for "can\'t reach database" message regardless of err.name', () => {
      expect(
        isTransientError(new Error("can't reach database server at host:5432")),
      ).toBe(true);
    });

    it('returns true when errorCode is P1001 (Prisma < v6 path)', () => {
      const err = new Error('Connection refused');
      (err as any).errorCode = 'P1001';
      expect(isTransientError(err)).toBe(true);
    });

    it('returns true when code is P1001 (PrismaClientKnownRequestError path)', () => {
      const err = new Error('DB unreachable');
      (err as any).code = 'P1001';
      expect(isTransientError(err)).toBe(true);
    });
  });

  // ── 2. Other recognised transient patterns ────────────────────────────────
  describe('other transient patterns', () => {
    it.each([
      ['terminating connection', 'terminating connection due to administrator command'],
      ['connection timed out', 'connection timed out after 5000 ms'],
      ['connection pool timeout', 'connection pool timeout: no slot available'],
      ['econnreset', 'read ECONNRESET'],
      ['etimedout', 'connect ETIMEDOUT 10.0.0.1:5432'],
      ['socket hang up', 'socket hang up'],
      ['server closed the connection', 'the server closed the connection unexpectedly'],
      ['prepared statement', 'prepared statement "s0" already exists'],
    ])('returns true for "%s"', (_label, message) => {
      expect(isTransientError(new Error(message))).toBe(true);
    });
  });

  // ── 3. Non-transient errors that must NOT be retried ─────────────────────
  describe('non-transient errors', () => {
    it('returns false for a generic application error', () => {
      expect(isTransientError(new Error('Invalid input'))).toBe(false);
    });

    it('returns false for P2002 unique-constraint violation', () => {
      const err = new Error('Unique constraint failed on email');
      (err as any).code = 'P2002';
      expect(isTransientError(err)).toBe(false);
    });

    it('returns false for any P2xxx Prisma error', () => {
      const err = new Error('Record not found');
      (err as any).code = 'P2025';
      expect(isTransientError(err)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isTransientError(null)).toBe(false);
    });

    it('returns false for a non-Error object', () => {
      expect(isTransientError({ message: 'oops' })).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('RETRY_DELAYS_MS', () => {
  it('contains exactly six delay entries', () => {
    expect(RETRY_DELAYS_MS).toHaveLength(6);
  });

  it('no single delay exceeds 8 000 ms', () => {
    for (const d of RETRY_DELAYS_MS) {
      expect(d).toBeLessThanOrEqual(8_000);
    }
  });

  it('total cumulative delay is bounded (≤ 30 000 ms)', () => {
    const total = RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(30_000);
  });

  it('delays are positive integers', () => {
    for (const d of RETRY_DELAYS_MS) {
      expect(d).toBeGreaterThan(0);
      expect(Number.isInteger(d)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('retry loop invariants', () => {
  // Cast vi.fn() to the concrete signature so runRetryLoop type-checks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sleepFn: (ms: number) => any;
  let sleepMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sleepMock = vi.fn().mockResolvedValue(undefined);
    sleepFn = sleepMock as unknown as (ms: number) => any;
  });

  it('retries a transient error exactly RETRY_DELAYS_MS.length times before the final attempt', async () => {
    const operation = vi.fn().mockRejectedValue(makePrismaInitError());

    await expect(runRetryLoop(operation, sleepFn)).rejects.toThrow();

    // 6 loop iterations + 1 final call = 7 total
    expect(operation).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
    expect(sleepMock).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length);
  });

  it('sleeps with the exact delay sequence from RETRY_DELAYS_MS', async () => {
    const operation = vi.fn().mockRejectedValue(makePrismaInitError());

    await expect(runRetryLoop(operation, sleepFn)).rejects.toThrow();

    const passedDelays = (sleepMock.mock.calls as unknown[][]).map((args) => args[0] as number);
    expect(passedDelays).toEqual(RETRY_DELAYS_MS);
  });

  it('does NOT retry a non-transient error (P2002)', async () => {
    const err = new Error('Unique constraint violated');
    (err as any).code = 'P2002';
    const operation = vi.fn().mockRejectedValue(err);

    await expect(runRetryLoop(operation, sleepFn)).rejects.toThrow('Unique constraint violated');

    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('returns on the first successful call without any retries', async () => {
    const operation = vi.fn().mockResolvedValue({ id: 'user-1' });

    const result = await runRetryLoop(operation, sleepFn);

    expect(result).toEqual({ id: 'user-1' });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleepMock).not.toHaveBeenCalled();
  });

  it('succeeds on the second attempt after one transient failure', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(makePrismaInitError())
      .mockResolvedValue({ id: 'user-1' });

    const result = await runRetryLoop(operation, sleepFn);

    expect(result).toEqual({ id: 'user-1' });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(RETRY_DELAYS_MS[0]);
  });
});
