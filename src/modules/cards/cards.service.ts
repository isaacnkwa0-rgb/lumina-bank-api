import { CardStatus, CardType, CardTier, TransactionCategory } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { generateVirtualCardPan, maskPan } from '../../shared/utils/account-number';
import { getPagination, buildPaginationMeta } from '../../shared/utils/pagination';

export interface IssueCardData {
  accountId: string;
  type?: CardType;
  tier?: CardTier;
}

export interface SpendingLimits {
  daily?: number;
  monthly?: number;
  perTransaction?: number;
}

export interface CardControls {
  online?: boolean;
  contactless?: boolean;
  international?: boolean;
  atm?: boolean;
}

export interface CardTransactionFilters {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

export class CardsService {
  async getCards(userId: string) {
    return prisma.card.findMany({
      where: { userId, status: { not: CardStatus.CANCELLED } },
      include: { account: { select: { accountNumber: true, currency: true, type: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCard(id: string, userId: string) {
    const card = await prisma.card.findFirst({
      where: { id, userId },
      include: { account: { select: { accountNumber: true, currency: true, type: true } } },
    });
    if (!card) throw new AppError('Card not found', 404, ErrorCodes.CARD_001);
    return card;
  }

  async issueCard(userId: string, data: IssueCardData) {
    // Verify account belongs to user
    const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
    if (!account) throw new AppError('Account not found', 404, ErrorCodes.ACCT_001);

    // Fetch user's name for cardholder
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);

    const cardType = data.type ?? CardType.DEBIT;
    const cardTier = data.tier ?? CardTier.STANDARD;

    // Generate a Visa-like 16-digit PAN and mask it
    const pan = generateVirtualCardPan();
    const maskedPan = maskPan(pan);

    const now = new Date();
    const expiryMonth = now.getMonth() + 1; // 1-based
    const expiryYear = now.getFullYear() + 3;

    return prisma.card.create({
      data: {
        userId,
        accountId: data.accountId,
        type: cardType,
        tier: cardTier,
        maskedPan,
        expiryMonth,
        expiryYear,
        cardholderName: `${user.firstName} ${user.lastName}`.toUpperCase(),
        currency: account.currency,
        isVirtual: false,
      },
    });
  }

  async freeze(id: string, userId: string) {
    const card = await this.getCard(id, userId);
    if (card.isFrozen) throw new AppError('Card is already frozen', 400, ErrorCodes.CARD_002);
    if (card.status !== CardStatus.ACTIVE)
      throw new AppError('Only active cards can be frozen', 400, ErrorCodes.CARD_002);
    return prisma.card.update({
      where: { id },
      data: { isFrozen: true, status: CardStatus.FROZEN },
    });
  }

  async unfreeze(id: string, userId: string) {
    const card = await this.getCard(id, userId);
    if (!card.isFrozen) throw new AppError('Card is not frozen', 400, ErrorCodes.CARD_002);
    return prisma.card.update({
      where: { id },
      data: { isFrozen: false, status: CardStatus.ACTIVE },
    });
  }

  async updateLimits(id: string, userId: string, limits: SpendingLimits) {
    const card = await this.getCard(id, userId);
    const current = card.spendingLimits as Record<string, number>;
    const updated = { ...current, ...limits };
    return prisma.card.update({ where: { id }, data: { spendingLimits: updated } });
  }

  async updateControls(id: string, userId: string, controls: CardControls) {
    const card = await this.getCard(id, userId);
    const current = card.controls as Record<string, boolean>;
    const updated = { ...current, ...controls };
    return prisma.card.update({ where: { id }, data: { controls: updated } });
  }

  async issueVirtual(userId: string, accountId: string) {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new AppError('Account not found', 404, ErrorCodes.ACCT_001);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!user) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);

    const pan = generateVirtualCardPan();
    const maskedPan = maskPan(pan);

    const now = new Date();
    const expiryMonth = now.getMonth() + 1;
    const expiryYear = now.getFullYear() + 3;

    return prisma.card.create({
      data: {
        userId,
        accountId,
        type: CardType.VIRTUAL,
        tier: CardTier.STANDARD,
        maskedPan,
        expiryMonth,
        expiryYear,
        cardholderName: `${user.firstName} ${user.lastName}`.toUpperCase(),
        currency: account.currency,
        isVirtual: true,
      },
    });
  }

  async reportLost(id: string, userId: string) {
    const card = await this.getCard(id, userId);
    if (card.status === CardStatus.BLOCKED)
      throw new AppError('Card is already blocked', 400, ErrorCodes.CARD_003);
    if (card.status === CardStatus.CANCELLED)
      throw new AppError('Card has been cancelled', 400, ErrorCodes.CARD_003);
    return prisma.card.update({
      where: { id },
      data: { status: CardStatus.BLOCKED, isFrozen: false },
    });
  }

  async replace(id: string, userId: string) {
    const oldCard = await this.getCard(id, userId);

    // Cancel old card
    await prisma.card.update({ where: { id }, data: { status: CardStatus.CANCELLED } });

    const pan = generateVirtualCardPan();
    const maskedPan = maskPan(pan);

    const now = new Date();
    const expiryMonth = now.getMonth() + 1;
    const expiryYear = now.getFullYear() + 3;

    return prisma.card.create({
      data: {
        userId,
        accountId: oldCard.accountId,
        type: oldCard.type,
        tier: oldCard.tier,
        maskedPan,
        expiryMonth,
        expiryYear,
        cardholderName: oldCard.cardholderName,
        currency: oldCard.currency,
        isVirtual: oldCard.isVirtual,
        spendingLimits: oldCard.spendingLimits as any,
        controls: oldCard.controls as any,
      },
    });
  }

  async getCardTransactions(id: string, userId: string, filters: CardTransactionFilters) {
    // Ensure card belongs to user
    const card = await this.getCard(id, userId);

    const { skip, take, page, limit } = getPagination({
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    });

    const where: any = {
      accountId: card.accountId,
      category: TransactionCategory.CARD_PAYMENT,
    };

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, meta: buildPaginationMeta(total, page, limit) };
  }
}

export const cardsService = new CardsService();
