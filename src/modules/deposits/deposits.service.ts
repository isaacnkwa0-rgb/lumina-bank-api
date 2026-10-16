import { Decimal } from '@prisma/client/runtime/library';
import { DepositMethod, DepositStatus, NotificationType, TransactionCategory } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';
import { generateTransactionReference } from '../../shared/utils/transaction-ref';
import { notifyAdmin } from '../../shared/utils/notify-admin';

const PAYPAL_BASE = process.env.PAYPAL_MODE === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

async function getPayPalToken(): Promise<string> {
  const creds = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

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

  async createPaypalOrder(userId: string, accountId: string, amount: number) {
    if (amount <= 0) throw new AppError('Amount must be greater than 0', 400);
    if (amount > 50000) throw new AppError('Maximum single deposit is £50,000', 400);

    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new AppError('Account not found', 404, ErrorCodes.NOT_FOUND);

    const reference = generateTransactionReference();
    const token = await getPayPalToken();

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': reference,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: reference,
          amount: { currency_code: account.currency.toUpperCase(), value: amount.toFixed(2) },
          description: 'Lumina Bank deposit',
        }],
      }),
    });

    const order = await res.json() as { id: string; status: string };
    if (!order.id) throw new AppError('Failed to create PayPal order', 500);

    return { orderId: order.id, reference };
  }

  async capturePaypalDeposit(userId: string, orderId: string, accountId: string, amount: number) {
    const token = await getPayPalToken();

    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    const capture = await captureRes.json() as {
      id: string;
      status: string;
      payer?: { email_address?: string; name?: { given_name?: string; surname?: string } };
      purchase_units?: Array<{
        reference_id?: string;
        payments?: { captures?: Array<{ id: string; amount: { value: string } }> };
      }>;
    };

    if (capture.status !== 'COMPLETED') throw new AppError('Payment not completed', 400);

    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new AppError('Account not found', 404, ErrorCodes.NOT_FOUND);

    const reference = capture.purchase_units?.[0]?.reference_id ?? orderId;
    const payerEmail = capture.payer?.email_address ?? null;

    const existing = await prisma.deposit.findFirst({ where: { reference } });
    if (existing) return existing;

    const deposit = await prisma.deposit.create({
      data: {
        userId,
        accountId,
        method: DepositMethod.CARD,
        amount: new Decimal(amount),
        currency: account.currency,
        reference,
        status: DepositStatus.COMPLETED,
        paypalOrderId: orderId,
        cardholderName: capture.payer?.name
          ? `${capture.payer.name.given_name ?? ''} ${capture.payer.name.surname ?? ''}`.trim()
          : null,
      },
    });

    // Log the successful attempt
    await prisma.cardAttemptLog.upsert({
      where: { paypalOrderId: orderId },
      create: {
        userId,
        accountId,
        paypalOrderId: orderId,
        amount: new Decimal(amount),
        currency: account.currency,
        status: 'SUCCEEDED',
        payerEmail,
        cardholderName: deposit.cardholderName,
      },
      update: {},
    });

    await prisma.account.update({
      where: { id: accountId },
      data: {
        balance: { increment: new Decimal(amount) },
        availableBalance: { increment: new Decimal(amount) },
      },
    });

    await prisma.transaction.create({
      data: {
        accountId,
        type: 'CREDIT',
        category: TransactionCategory.DEPOSIT,
        amount: new Decimal(amount),
        currency: account.currency,
        description: 'PayPal deposit',
        reference,
        status: 'COMPLETED',
        balanceBefore: new Decimal(Number(account.balance)),
        balanceAfter: new Decimal(Number(account.balance) + amount),
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.TRANSACTION,
        title: 'PayPal Deposit Successful',
        body: `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })} has been added to your ${account.type.charAt(0) + account.type.slice(1).toLowerCase()} account.`,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    if (user) {
      notifyAdmin({ type: 'DEPOSIT_REQUEST', firstName: user.firstName, lastName: user.lastName, email: user.email, method: 'PayPal', amount, currency: account.currency, reference, depositId: deposit.id });
    }

    return deposit;
  }

  async logPaypalAttempt(userId: string, data: {
    orderId: string;
    accountId: string;
    amount: number;
    status: 'SUCCEEDED' | 'FAILED';
    errorCode?: string | null;
    errorMessage?: string | null;
    payerEmail?: string | null;
    cardholderName?: string | null;
  }) {
    const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
    if (!account) throw new AppError('Account not found', 404, ErrorCodes.NOT_FOUND);

    return prisma.cardAttemptLog.upsert({
      where: { paypalOrderId: data.orderId },
      create: {
        userId,
        accountId: data.accountId,
        paypalOrderId: data.orderId,
        amount: new Decimal(data.amount),
        currency: account.currency,
        status: data.status,
        errorCode: data.errorCode || null,
        errorMessage: data.errorMessage || null,
        payerEmail: data.payerEmail || null,
        cardholderName: data.cardholderName || null,
      },
      update: {},
    });
  }
}

export const depositsService = new DepositsService();
