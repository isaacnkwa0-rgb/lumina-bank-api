import { Decimal } from '@prisma/client/runtime/library';
import { CryptoOrderStatus, TransactionType, TransactionCategory, NotificationType } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { generateTransactionReference } from '../../shared/utils/transaction-ref';

interface CreateOrderInput {
  accountId: string;
  coin: string;
  coinId: string;
  network: string;
  walletAddress: string;
  amountGbp: number;
  priceGbp: number;
}

export class CryptoService {
  async createOrder(userId: string, data: CreateOrderInput) {
    const { accountId, coin, coinId, network, walletAddress, amountGbp, priceGbp } = data;

    if (amountGbp <= 0) throw new AppError('Amount must be greater than 0', 400);
    if (priceGbp <= 0) throw new AppError('Invalid coin price', 400);
    if (walletAddress.trim().length < 8) throw new AppError('Invalid wallet address', 400);

    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new AppError('Account not found', 404, ErrorCodes.ACCT_001);
    if (account.status === 'FROZEN') throw new AppError('Account is frozen', 403, ErrorCodes.ACCT_002);

    const fee = new Decimal('1.50');
    const amount = new Decimal(amountGbp);
    const total = amount.plus(fee);

    if (account.availableBalance.lessThan(total)) {
      throw new AppError('Insufficient funds', 400, ErrorCodes.ACCT_003);
    }

    const quantity = amountGbp / priceGbp;
    const reference = generateTransactionReference();
    const balanceBefore = account.balance;
    const balanceAfter = account.balance.minus(total);

    const order = await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: accountId },
        data: {
          balance: balanceAfter,
          availableBalance: account.availableBalance.minus(total),
        },
      });

      await tx.transaction.create({
        data: {
          reference,
          accountId,
          type: TransactionType.DEBIT,
          category: TransactionCategory.TRANSFER,
          amount: total,
          currency: account.currency,
          balanceBefore,
          balanceAfter,
          description: `Crypto purchase: ${coin} → ${walletAddress.trim().slice(0, 14)}…`,
          counterpartyName: `${coin} Wallet`,
          counterpartyAccountNumber: walletAddress.trim(),
          status: 'COMPLETED',
          valueDate: new Date(),
        },
      });

      return tx.cryptoOrder.create({
        data: {
          userId,
          accountId,
          coin,
          coinId,
          network,
          walletAddress: walletAddress.trim(),
          amountGbp: amount,
          fee,
          priceGbp: new Decimal(priceGbp),
          quantity: new Decimal(quantity),
          reference,
          status: CryptoOrderStatus.PENDING,
        },
      });
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SYSTEM,
        title: 'Crypto Order Submitted',
        body: `Your order to buy ${coin} worth £${amountGbp.toFixed(2)} has been submitted for compliance review. Reference: ${reference}`,
      },
    });

    return order;
  }

  async listOrders(userId: string) {
    return prisma.cryptoOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrder(id: string, userId: string) {
    const order = await prisma.cryptoOrder.findFirst({ where: { id, userId } });
    if (!order) throw new AppError('Order not found', 404, ErrorCodes.NOT_FOUND);
    return order;
  }
}

export const cryptoService = new CryptoService();
