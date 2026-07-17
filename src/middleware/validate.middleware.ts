import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError, ErrorCodes } from '../shared/utils/api-response';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const details = (result.error as ZodError).issues.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      sendError(res, ErrorCodes.VAL_001, 'Validation failed', 422, details, req.requestId);
      return;
    }

    req[part] = result.data;
    next();
  };
}
