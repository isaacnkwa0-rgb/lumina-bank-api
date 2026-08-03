import { Decimal } from '@prisma/client/runtime/library';
import { DepositMethod, DepositStatus, NotificationType, TransactionType, TransactionCategory } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { generateTransactionReference } from '../../shared/utils/transaction-ref';
import { notifyAdmin } from '../../shared/utils/notify-admin';

// Bank's own receiving details shown to users doing bank transfers
const BANK_RECEIVING = {
  accountName: 'Lumina Bank Client Accounts',
  sortCode: '20-45-78',
  accountNumber: '12345678',
  iban: 'GB29NWBK60161331926819',
};

// Bank's crypto wallet addresses per coin (configure more as needed)
const CRYPTO_WALLETS: Record<string, { address: string; network: string }> = {
  BTC:  { address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', network: 'Bitcoin' },
  ETH:  { address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', network: 'Ethereum (ERC-20)' },
  USDT: { address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', network: 'Ethereum (ERC-20)' },
  BNB:  { address: 'bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2', network: 'BNB Chain' },
  SOL:  { address: 'So11111111111111111111111111111111111111112',  network: 'Solana' },
};

interface InitiateBankTransferInput {
  accountId: string;
  amount: number;
  senderName?: string;
  senderBank?: string;
}

interface InitiateCryptoDepositInput {
  accountId: string;
  coin: string;
  network: string;
  coinAmount: number;
  priceGbp: number;
}

export class DepositsService {
  async initiateBankTransfer(userId: string, data: InitiateBankTransferInput) {
    const { accountId, amount, senderName, senderBank } = data;

    if (amount <= 0) throw new AppError('Amount must be greater than 0', 400);
    if (amount > 50000) throw new AppError('Single deposit limit is £50,000. Contact support for larger amounts.', 400);

    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new AppError('Account not found', 404, ErrorCodes.ACCT_001);
    if (account.status === 'FROZEN') throw new AppError('Account is frozen', 403, ErrorCodes.ACCT_002);
    if (account.status === 'CLOSED') throw new AppError('Account is closed', 403);

    const reference = generateTransactionReference();

    const deposit = await prisma.deposit.create({
      data: {
        userId,
        accountId,
        method: DepositMethod.BANK_TRANSFER,
        amount: new Decimal(amount),
        currency: account.currency,
        reference,
        senderName: senderName?.trim() || null,
        senderBank: senderBank?.trim() || null,
        status: DepositStatus.PENDING,
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.TRANSACTION,
        title: 'Deposit Request Received',
        body: `Your bank transfer deposit of £${amount.toFixed(2)} has been received and is pending verification. Reference: ${reference}`,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    if (user) {
      notifyAdmin({ type: 'DEPOSIT_REQUEST', firstName: user.firstName, lastName: user.lastName, email: user.email, method: 'Bank Transfer', amount, currency: account.currency, reference, depositId: deposit.id });
    }

    return { deposit, bankDetails: BANK_RECEIVING };
  }

  async initiateCryptoDeposit(userId: string, data: InitiateCryptoDepositInput) {
    const { accountId, coin, network, coinAmount, priceGbp } = data;

    if (coinAmount <= 0) throw new AppError('Coin amount must be greater than 0', 400);
    if (priceGbp <= 0) throw new AppError('Invalid coin price', 400);

    const upperCoin = coin.toUpperCase();
    const walletInfo = CRYPTO_WALLETS[upperCoin];
    if (!walletInfo) throw new AppError(`Unsupported coin: ${coin}. Supported: ${Object.keys(CRYPTO_WALLETS).join(', ')}`, 400);

    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new AppError('Account not found', 404, ErrorCodes.ACCT_001);
    if (account.status === 'FROZEN') throw new AppError('Account is frozen', 403, ErrorCodes.ACCT_002);
    if (account.status === 'CLOSED') throw new AppError('Account is closed', 403);

    const amountGbp = new Decimal(coinAmount).times(new Decimal(priceGbp));
    const reference = generateTransactionReference();

    const deposit = await prisma.deposit.create({
      data: {
        userId,
        accountId,
        method: DepositMethod.CRYPTO,
        amount: amountGbp,
        currency: account.currency,
        reference,
        coin: upperCoin,
        network,
        coinAmount: new Decimal(coinAmount),
        priceGbp: new Decimal(priceGbp),
        status: DepositStatus.PENDING,
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.TRANSACTION,
        title: 'Crypto Deposit Initiated',
        body: `Send ${coinAmount} ${upperCoin} to the address below. Your account will be credited once confirmed. Reference: ${reference}`,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    if (user) {
      notifyAdmin({ type: 'DEPOSIT_REQUEST', firstName: user.firstName, lastName: user.lastName, email: user.email, method: `Crypto (${upperCoin})`, amount: amountGbp.toNumber(), currency: account.currency, reference, depositId: deposit.id });
    }

    return {
      deposit,
      walletAddress: walletInfo.address,
      network: walletInfo.network,
      coin: upperCoin,
      coinAmount,
      estimatedGbp: amountGbp.toNumber(),
    };
  }

  async listDeposits(userId: string) {
    return prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDeposit(id: string, userId: string) {
    const deposit = await prisma.deposit.findFirst({ where: { id, userId } });
    if (!deposit) throw new AppError('Deposit not found', 404, ErrorCodes.NOT_FOUND);
    return deposit;
  }

  getSupportedCoins() {
    return Object.entries(CRYPTO_WALLETS).map(([coin, info]) => ({ coin, network: info.network }));
  }
}

export const depositsService = new DepositsService();
