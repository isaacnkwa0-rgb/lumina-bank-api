import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { SupportTicketStatus, SenderRole, NotificationType } from '@prisma/client';
import { ErrorCodes } from '../../shared/utils/api-response';
import { mailService } from '../../shared/services/mail.service';
import { notifyAdmin } from '../../shared/utils/notify-admin';

const senderSelect = {
  select: {
    firstName: true,
    lastName: true,
    profile: { select: { avatarUrl: true } },
  },
} as const;

// In-memory typing state: ticketId → timestamp of last agent keystroke
const agentTypingMap = new Map<string, number>();
const TYPING_TTL_MS = 5000;

export class SupportService {
  setAgentTyping(ticketId: string): void {
    agentTypingMap.set(ticketId, Date.now());
  }

  isAgentTyping(ticketId: string): boolean {
    const ts = agentTypingMap.get(ticketId);
    return !!ts && Date.now() - ts < TYPING_TTL_MS;
  }

  async createTicket(userId: string, subject: string, body: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject,
        messages: {
          create: { senderId: userId, senderRole: SenderRole.CUSTOMER, body },
        },
      },
      include: {
        messages: {
          include: { sender: senderSelect },
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SYSTEM,
        title: 'Support ticket opened',
        body: `Your ticket "${subject}" has been received. Our team will respond shortly.`,
      },
    });

    if (user) {
      mailService.sendTicketSubmitted(user.email, { firstName: user.firstName, subject }).catch(() => {});
      notifyAdmin({ type: 'NEW_SUPPORT_TICKET', firstName: user.firstName, lastName: user.lastName, email: user.email, subject, firstMessage: body, ticketId: ticket.id });
      notifyAgents(ticket.id, subject, `${user.firstName} ${user.lastName}`, user.email, body);
    }

    return ticket;
  }

  async getTickets(userId: string) {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: senderSelect },
        },
        _count: {
          select: {
            messages: {
              where: { senderRole: SenderRole.AGENT, isRead: false },
            },
          },
        },
      },
    });

    return tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      lastMessage: t.messages[0] ?? null,
      unreadCount: t._count.messages,
    }));
  }

  async getTicket(id: string, userId: string) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: senderSelect },
        },
      },
    });
    if (!ticket) throw new AppError('Ticket not found', 404, ErrorCodes.NOT_FOUND);

    await prisma.supportMessage.updateMany({
      where: { ticketId: id, senderRole: SenderRole.AGENT, isRead: false },
      data: { isRead: true },
    });

    return ticket;
  }

  async postMessage(ticketId: string, userId: string, body: string) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    if (!ticket) throw new AppError('Ticket not found', 404, ErrorCodes.NOT_FOUND);
    if (ticket.status === SupportTicketStatus.CLOSED || ticket.status === SupportTicketStatus.RESOLVED)
      throw new AppError('This ticket is closed', 400, ErrorCodes.VAL_001);

    const [message] = await Promise.all([
      prisma.supportMessage.create({
        data: { ticketId, senderId: userId, senderRole: SenderRole.CUSTOMER, body },
        include: { sender: senderSelect },
      }),
      prisma.supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      }),
    ]);

    notifyAdmin({ type: 'SUPPORT_MESSAGE', firstName: ticket.user.firstName, lastName: ticket.user.lastName, email: ticket.user.email, subject: ticket.subject, messageBody: body, ticketId });
    notifyAgents(ticketId, ticket.subject, `${ticket.user.firstName} ${ticket.user.lastName}`, ticket.user.email, body);

    return message;
  }

  async closeTicket(id: string, userId: string) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId },
      include: { user: { select: { email: true, firstName: true } } },
    });
    if (!ticket) throw new AppError('Ticket not found', 404, ErrorCodes.NOT_FOUND);
    if (ticket.status === SupportTicketStatus.CLOSED)
      throw new AppError('Ticket is already closed', 400, ErrorCodes.VAL_001);

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { status: SupportTicketStatus.CLOSED },
    });

    mailService.sendTicketClosed(ticket.user.email, {
      firstName: ticket.user.firstName,
      subject: ticket.subject,
    }).catch(() => {});

    return updated;
  }
}

export const supportService = new SupportService();

function notifyAgents(ticketId: string, subject: string, customerName: string, customerEmail: string, messageBody: string): void {
  prisma.user.findMany({
    where: { role: 'AGENT', status: 'ACTIVE' },
    select: { email: true },
  }).then((agents) => {
    for (const agent of agents) {
      mailService.sendCustomerRepliedAlert(agent.email, { ticketId, subject, customerName, messageBody }).catch(() => {});
    }
  }).catch(() => {});
}
