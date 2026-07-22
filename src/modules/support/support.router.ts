import { Router } from 'express';
import { z } from 'zod';
import supportController from './support.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';

const router = Router();

const createTicketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(120),
  body: z.string().min(10, 'Message must be at least 10 characters').max(2000),
});

const messageSchema = z.object({
  body: z.string().min(1).max(2000),
});

router.use(authenticate);

router.get('/tickets', supportController.getTickets.bind(supportController));
router.post('/tickets', validate(createTicketSchema), supportController.createTicket.bind(supportController));
router.get('/tickets/:id', supportController.getTicket.bind(supportController));
router.post('/tickets/:id/messages', validate(messageSchema), supportController.postMessage.bind(supportController));
router.patch('/tickets/:id/close', supportController.closeTicket.bind(supportController));

export default router;
