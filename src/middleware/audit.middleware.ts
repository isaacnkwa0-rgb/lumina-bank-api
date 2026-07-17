import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export function auditLog(action: string, resource?: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action,
          resource,
          resourceId: req.params?.id as string | undefined ?? null,
          ipAddress: req.ip ?? null,
          userAgent: req.get('user-agent'),
          metadata: { method: req.method, path: req.path },
        },
      });
    } catch (err) {
      logger.error('Failed to write audit log', { error: err, action });
    }
    next();
  };
}
