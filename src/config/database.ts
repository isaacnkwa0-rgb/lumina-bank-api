import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';

declare global {
  var __prisma: ReturnType<typeof createPrisma> | undefined;
}

const RETRY_DELAYS_MS = [500, 1000, 2000]; // exponential back-off: 0.5s → 1s → 2s

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isTransientError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const code = (err as any)?.code as string | undefined;
  return (
    msg.includes('terminating connection') ||
    msg.includes('connection timed out') ||
    msg.includes('connection pool timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('server closed the connection') ||
    msg.includes('prepared statement') ||
    (code !== undefined && code.startsWith('P1'))
  );
}

function createPrisma() {
  const connectionUrl = env.DATABASE_URL.includes('connection_limit')
    ? env.DATABASE_URL
    : `${env.DATABASE_URL}${env.DATABASE_URL.includes('?') ? '&' : '?'}connection_limit=5&pool_timeout=30`;

  const base = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: connectionUrl } },
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
            try {
              return await query(args);
            } catch (err) {
              if (!isTransientError(err)) throw err;
              logger.warn('DB transient error — retrying', {
                attempt: attempt + 1,
                delayMs: RETRY_DELAYS_MS[attempt],
                error: err instanceof Error ? err.message : String(err),
              });
              await sleep(RETRY_DELAYS_MS[attempt]);
            }
          }
          // Final attempt — let it throw
          return query(args);
        },
      },
    },
  });
}

const prisma = global.__prisma ?? createPrisma();

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export { prisma };
