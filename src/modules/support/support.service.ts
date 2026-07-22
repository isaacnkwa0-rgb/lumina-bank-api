import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { SupportTicketStatus, SenderRole, NotificationType } from '@prisma/client';
import { ErrorCodes } from '../../shared/utils/api-response';

export class SupportService {
  async createTicket(userId: string, subject: string, body: string) {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject,
        messages: {
          create: { senderId: userId, senderRole: SenderRole.CUSTOMER, body },
        },
      },
      include: { messages: true },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SYSTEM,
        title: 'Support ticket opened',
        body: `Your ticket "${subject}" has been received. Our team will respond shortly.`,
      },
    });

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
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) throw new AppError('Ticket not found', 404, ErrorCodes.NOT_FOUND);

    // Mark agent messages as read
    await prisma.supportMessage.updateMany({
      where: { ticketId: id, senderRole: SenderRole.AGENT, isRead: false },
      data: { isRead: true },
    });

    return ticket;
  }

  async postMessage(ticketId: string, userId: string, body: string) {
    const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, userId } });
    if (!ticket) throw new AppError('Ticket not found', 404, ErrorCodes.NOT_FOUND);
    if (ticket.status === SupportTicketStatus.CLOSED || ticket.status === SupportTicketStatus.RESOLVED)
      throw new AppError('This ticket is closed', 400, ErrorCodes.VAL_001);

    const [message] = await Promise.all([
      prisma.supportMessage.create({
        data: { ticketId, senderId: userId, senderRole: SenderRole.CUSTOMER, body },
      }),
      prisma.supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return message;
  }

  async closeTicket(id: string, userId: string) {
    const ticket = await prisma.supportTicket.findFirst({ where: { id, userId } });
    if (!ticket) throw new AppError('Ticket not found', 404, ErrorCodes.NOT_FOUND);
    if (ticket.status === SupportTicketStatus.CLOSED)
      throw new AppError('Ticket is already closed', 400, ErrorCodes.VAL_001);

    return prisma.supportTicket.update({
      where: { id },
      data: { status: SupportTicketStatus.CLOSED },
    });
  }
}

export const supportService = new SupportService();
