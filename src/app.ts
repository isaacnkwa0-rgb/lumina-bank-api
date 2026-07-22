import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env';
import { logger } from './config/logger';
import { swaggerSpec } from './config/swagger';
import { requestId } from './middleware/request-id.middleware';
import { generalLimiter } from './middleware/rate-limit.middleware';
import { notFoundHandler, globalErrorHandler } from './middleware/error.middleware';

// Routers
import { authRouter } from './modules/auth/auth.router';
import { usersRouter } from './modules/users/users.router';
import { accountsRouter } from './modules/accounts/accounts.router';
import { transactionsRouter } from './modules/transactions/transactions.router';
import { transfersRouter } from './modules/transfers/transfers.router';
import { ratesRouter } from './modules/rates/rates.router';

export function createApp() {
  const app = express();

  // Trust Railway's reverse proxy so rate limiter sees real client IPs
  app.set('trust proxy', 1);

  // CORS — validate origin against allowlist
  const allowedOrigins = new Set(
    env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  );
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  // Security headers
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  }));

  // Body parsing
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Static uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Logging
  app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));

  // Request ID
  app.use(requestId);

  // Rate limiting
  app.use(generalLimiter);

  // Health check
  app.get('/health', async (_req, res) => {
    const { prisma } = await import('./config/database');
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
    }
  });

  // API Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Lumina Bank API' }));
  app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

  // API Routes
  const v = `/api/${env.API_VERSION}`;
  app.use(`${v}/auth`, authRouter);
  app.use(`${v}/users`, usersRouter);
  app.use(`${v}/accounts`, accountsRouter);
  app.use(`${v}/transactions`, transactionsRouter);
  app.use(`${v}/transfers`, transfersRouter);
  app.use(`${v}/rates`, ratesRouter);

  // Dynamically mount optional modules (written by subagents)
  mountIfExists(app, `${v}/beneficiaries`, './modules/beneficiaries/beneficiaries.router');
  mountIfExists(app, `${v}/cards`, './modules/cards/cards.router');
  mountIfExists(app, `${v}/notifications`, './modules/notifications/notifications.router');
  mountIfExists(app, `${v}/investments`, './modules/investments/investments.router');
  mountIfExists(app, `${v}/loans`, './modules/loans/loans.router');
  mountIfExists(app, `${v}/goals`, './modules/savings-goals/goals.router');
  mountIfExists(app, `${v}/analytics`, './modules/analytics/analytics.router');
  mountIfExists(app, `${v}/kyc`, './modules/kyc/kyc.router');
  mountIfExists(app, `${v}/disputes`, './modules/disputes/disputes.router');
  mountIfExists(app, `${v}/insurance`, './modules/insurance/insurance.router');
  mountIfExists(app, `${v}/crypto`, './modules/crypto/crypto.router');
  mountIfExists(app, `${v}/standing-orders`, './modules/standing-orders/standing-orders.router');
  mountIfExists(app, `${v}/direct-debits`, './modules/direct-debits/direct-debits.router');
  mountIfExists(app, `${v}/support`, './modules/support/support.router');
  mountIfExists(app, `${v}/admin`, './modules/admin/admin.router');

  // 404 + error handler
  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}

function mountIfExists(app: express.Application, path: string, modulePath: string) {
  try {
    const { default: router, ...named } = require(modulePath);
    const routerExport = router ?? Object.values(named)[0];
    if (routerExport) app.use(path, routerExport);
  } catch {
    // Module not yet available — skip silently
  }
}
