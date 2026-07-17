import { Role, UserTier, UserStatus } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
        tier: UserTier;
        status: UserStatus;
      };
      requestId?: string;
    }
  }
}

export {};
