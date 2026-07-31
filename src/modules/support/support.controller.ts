import { Request, Response, NextFunction } from 'express';
import { supportService } from './support.service';
import { sendSuccess } from '../../shared/utils/api-response';

export class SupportController {
  async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { subject, body } = req.body as { subject: string; body: string };
      const ticket = await supportService.createTicket(req.user!.id, subject, body);
      sendSuccess(res, ticket, 'Ticket created', 201);
    } catch (err) {
      next(err);
    }
  }

  async getTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const tickets = await supportService.getTickets(req.user!.id);
      sendSuccess(res, tickets, 'Tickets retrieved');
    } catch (err) {
      next(err);
    }
  }

  async getTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await supportService.getTicket(req.params.id as string, req.user!.id);
      sendSuccess(res, ticket, 'Ticket retrieved');
    } catch (err) {
      next(err);
    }
  }

  async postMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { body } = req.body as { body: string };
      const message = await supportService.postMessage(req.params.id as string, req.user!.id, body);
      sendSuccess(res, message, 'Message sent', 201);
    } catch (err) {
      next(err);
    }
  }

  async closeTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await supportService.closeTicket(req.params.id as string, req.user!.id);
      sendSuccess(res, ticket, 'Ticket closed');
    } catch (err) {
      next(err);
    }
  }

  // Called by agent/admin while typing — sets a short-lived timestamp
  setTyping(req: Request, res: Response, _next: NextFunction): void {
    supportService.setAgentTyping(req.params.id as string);
    res.status(204).end();
  }

  // Called by user — returns whether an agent typed within the last 5 s
  getTyping(req: Request, res: Response, _next: NextFunction): void {
    sendSuccess(res, { typing: supportService.isAgentTyping(req.params.id as string) });
  }
}

export default new SupportController();
