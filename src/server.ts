import { createApp } from './app';
import { prisma } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import { ratesService } from './modules/rates/rates.service';

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');

    const app = createApp();

    // Fetch live rates on startup then every hour
    ratesService.refreshRates();
    setInterval(() => ratesService.refreshRates(), 60 * 60 * 1000);

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Lumina Bank API running on http://localhost:${env.PORT}`);
      logger.info(`📚 API Docs at http://localhost:${env.PORT}/api-docs`);
      logger.info(`🔍 Health at http://localhost:${env.PORT}/health`);
      logger.info(`📌 Environment: ${env.NODE_ENV}`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database disconnected');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      shutdown('unhandledRejection');
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      shutdown('uncaughtException');
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

bootstrap();
