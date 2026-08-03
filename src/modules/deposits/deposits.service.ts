import { Decimal } from '@prisma/client/runtime/library';
import { DepositMethod, DepositStatus, NotificationType } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { generateTransactionReference } from '../../shared/utils/transaction-ref';
import { notifyAdmin } from '../../shared/utils/notify-admin';

type CryptoWallets = Record<string, { address: string; network: string }>;

async function getSettings() {
  const s = await prisma.depositSettings.findUnique({ where: { id: 'default' } });
  if (s) return s;
  // Auto-create with defaults if missing
  return prisma.depositSettings.create({
    data: {
      id: 'default',
      cryptoWallets: {
        BTC:  { address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', network: 'Bitcoin' },
        ETH:  { address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', network: 'Ethereum (ERC-20)' },
        USDT: { address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', network: 'Ethereum (ERC-20)' },
        BNB:  { address: 'bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2', network: 'BNB Chain' },
        SOL:  { address: 'So11111111111111111111111111111111111111112', network: 'Solana' },
      },
    },
  });
}

interface InitiateBankTransferInput {
  accountId: string;
  amount: number;
  senderName?: string;
  senderBank?: string;
}

interface InitiateCryptoDepositInput {
  accountId: string;
  coin: string;
  amountGbp: number;
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

    const settings = await getSettings();
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

    return {
      deposit,
      bankDetails: {
        accountName: settings.bankAccountName,
        sortCode: settings.bankSortCode,
        accountNumber: settings.bankAccountNumber,
        iban: settings.bankIban,
      },
    };
  }

  async initiateCryptoDeposit(userId: string, data: InitiateCryptoDepositInput) {
    const { accountId, coin, amountGbp, priceGbp } = data;

    if (amountGbp <= 0) throw new AppError('Amount must be greater than 0', 400);
    if (priceGbp <= 0) throw new AppError('Invalid coin price', 400);

    const upperCoin = coin.toUpperCase();
    const settings = await getSettings();
    const wallets = settings.cryptoWallets as CryptoWallets;
    const walletInfo = wallets[upperCoin];
    if (!walletInfo) {
      throw new AppError(`Unsupported coin: ${coin}. Supported: ${Object.keys(wallets).join(', ')}`, 400);
    }

    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new AppError('Account not found', 404, ErrorCodes.ACCT_001);
    if (account.status === 'FROZEN') throw new AppError('Account is frozen', 403, ErrorCodes.ACCT_002);
    if (account.status === 'CLOSED') throw new AppError('Account is closed', 403);

    const coinAmount = new Decimal(amountGbp).dividedBy(new Decimal(priceGbp));
    const reference = generateTransactionReference();

    const deposit = await prisma.deposit.create({
      data: {
        userId,
        accountId,
        method: DepositMethod.CRYPTO,
        amount: new Decimal(amountGbp),
        currency: account.currency,
        reference,
        coin: upperCoin,
        network: walletInfo.network,
        coinAmount,
        priceGbp: new Decimal(priceGbp),
        status: DepositStatus.PENDING,
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.TRANSACTION,
        title: 'Crypto Deposit Initiated',
        body: `Send ${coinAmount.toFixed(8)} ${upperCoin} to the address below. Your account will be credited £${amountGbp.toFixed(2)} once confirmed. Reference: ${reference}`,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    if (user) {
      notifyAdmin({ type: 'DEPOSIT_REQUEST', firstName: user.firstName, lastName: user.lastName, email: user.email, method: `Crypto (${upperCoin})`, amount: amountGbp, currency: account.currency, reference, depositId: deposit.id });
    }

    return {
      deposit,
      walletAddress: walletInfo.address,
      network: walletInfo.network,
      coin: upperCoin,
      coinAmount: coinAmount.toFixed(8),
      amountGbp,
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

  async getSupportedCoins() {
    const settings = await getSettings();
    const wallets = settings.cryptoWallets as CryptoWallets;
    return Object.entries(wallets).map(([coin, info]) => ({ coin, network: info.network }));
  }
}

export const depositsService = new DepositsService();
