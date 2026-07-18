import { Request, Response, NextFunction } from 'express';
import { standingOrdersService } from './standing-orders.service';
import { successResponse } from '../../shared/utils/api-response';

export const standingOrdersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await standingOrdersService.list(req.user!.id);
      res.json(successResponse(data));
    } catch (e) { next(e); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await standingOrdersService.create(req.user!.id, req.body);
      res.status(201).json(successResponse(data));
    } catch (e) { next(e); }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await standingOrdersService.cancel(req.params.id as string, req.user!.id);
      res.json(successResponse(data));
    } catch (e) { next(e); }
  },

  async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await standingOrdersService.pause(req.params.id as string, req.user!.id);
      res.json(successResponse(data));
    } catch (e) { next(e); }
  },

  async resume(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await standingOrdersService.resume(req.params.id as string, req.user!.id);
      res.json(successResponse(data));
    } catch (e) { next(e); }
  },

  async executeDue(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await standingOrdersService.executeDue();
      res.json(successResponse(data));
    } catch (e) { next(e); }
  },
};
