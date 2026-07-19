import { PrismaClient, AccountType, TransactionType, TransactionCategory, TransactionStatus, LoanType, AssetType, GoalStatus, FxRateSource } from '@prisma/client';
import bcrypt from 'bcrypt';
import { subDays, subMonths, addDays, format } from 'date-fns';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@lumina.bank';
const DEMO_PASSWORD = 'Demo1234!';

const MERCHANTS = [
  { name: 'Netflix', category: 'Entertainment', amount: [15.99, 22.99] },
  { name: 'Spotify', category: 'Entertainment', amount: [9.99, 9.99] },
  { name: 'Starbucks', category: 'Food & Drink', amount: [5.5, 12] },
  { name: 'Amazon', category: 'Shopping', amount: [20, 250] },
  { name: 'Uber', category: 'Transport', amount: [8, 45] },
  { name: 'Uber Eats', category: 'Food & Drink', amount: [15, 60] },
  { name: 'Shell', category: 'Transport', amount: [40, 80] },
  { name: 'Whole Foods', category: 'Groceries', amount: [30, 150] },
  { name: 'Apple', category: 'Shopping', amount: [1, 999] },
  { name: 'Google', category: 'Technology', amount: [0.99, 29.99] },
  { name: 'Walmart', category: 'Groceries', amount: [25, 120] },
  { name: 'Target', category: 'Shopping', amount: [20, 200] },
  { name: 'CVS Pharmacy', category: 'Health', amount: [10, 80] },
  { name: 'Planet Fitness', category: 'Health', amount: [10, 25] },
  { name: 'AT&T', category: 'Bills', amount: [45, 120] },
  { name: 'Verizon', category: 'Bills', amount: [50, 130] },
  { name: 'ConEd', category: 'Bills', amount: [60, 180] },
  { name: 'Airbnb', category: 'Travel', amount: [80, 500] },
  { name: 'Delta Airlines', category: 'Travel', amount: [200, 800] },
  { name: 'Zara', category: 'Shopping', amount: [30, 200] },
  { name: 'H&M', category: 'Shopping', amount: [20, 150] },
  { name: 'McDonald\'s', category: 'Food & Drink', amount: [5, 25] },
  { name: 'Chipotle', category: 'Food & Drink', amount: [10, 30] },
  { name: 'Trader Joe\'s', category: 'Groceries', amount: [20, 90] },
  { name: 'Home Depot', category: 'Shopping', amount: [25, 400] },
];

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('🌱 Seeding Lumina Bank database...');

  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.otpCode.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.watchlist.deleteMany(),
    prisma.investment.deleteMany(),
    prisma.portfolio.deleteMany(),
    prisma.loanPayment.deleteMany(),
    prisma.loan.deleteMany(),
    prisma.savingsGoal.deleteMany(),
    prisma.beneficiary.deleteMany(),
    prisma.transfer.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.card.deleteMany(),
    prisma.account.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.device.deleteMany(),
    prisma.exchangeRate.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // ── Exchange Rates ─────────────────────────────────────────────────────────
  const rates = [
    { base: 'USD', quote: 'EUR', rate: 0.9215 },
    { base: 'USD', quote: 'GBP', rate: 0.7890 },
    { base: 'USD', quote: 'NGN', rate: 1610.50 },
    { base: 'USD', quote: 'JPY', rate: 149.85 },
    { base: 'USD', quote: 'CAD', rate: 1.3645 },
    { base: 'USD', quote: 'AUD', rate: 1.5420 },
    { base: 'USD', quote: 'CHF', rate: 0.8970 },
    { base: 'USD', quote: 'CNY', rate: 7.2450 },
    { base: 'USD', quote: 'INR', rate: 83.40 },
    { base: 'USD', quote: 'BRL', rate: 4.9800 },
    { base: 'USD', quote: 'ZAR', rate: 18.75 },
    { base: 'USD', quote: 'MXN', rate: 17.25 },
    { base: 'USD', quote: 'SGD', rate: 1.3450 },
    { base: 'USD', quote: 'HKD', rate: 7.8250 },
    { base: 'USD', quote: 'SEK', rate: 10.580 },
    { base: 'USD', quote: 'NOK', rate: 10.650 },
    { base: 'USD', quote: 'DKK', rate: 6.870 },
    { base: 'USD', quote: 'AED', rate: 3.673 },
    { base: 'USD', quote: 'KES', rate: 129.50 },
    { base: 'USD', quote: 'GHS', rate: 15.80 },
    { base: 'USD', quote: 'EGP', rate: 48.90 },
    { base: 'USD', quote: 'PKR', rate: 279.50 },
    { base: 'USD', quote: 'NZD', rate: 1.635 },
    { base: 'USD', quote: 'TRY', rate: 32.45 },
    { base: 'EUR', quote: 'GBP', rate: 0.8560 },
    { base: 'EUR', quote: 'USD', rate: 1.0852 },
    { base: 'GBP', quote: 'USD', rate: 1.2675 },
    { base: 'GBP', quote: 'EUR', rate: 1.1683 },
  ];

  await prisma.exchangeRate.createMany({
    data: rates.map((r) => ({ baseCurrency: r.base, quoteCurrency: r.quote, rate: r.rate, source: FxRateSource.MOCK })),
  });
  console.log(`✅ Created ${rates.length} exchange rates`);

  // ── Demo User ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      firstName: 'Alex',
      lastName: 'Morgan',
      passwordHash,
      phone: '+447911123456',
      dateOfBirth: new Date('1990-05-15'),
      nationality: 'GB',
      tier: 'PREMIUM',
      kycStatus: 'VERIFIED',
      isEmailVerified: true,
      isPhoneVerified: true,
      status: 'ACTIVE',
      address: { street: '12 Canary Wharf', city: 'London', state: 'England', postalCode: 'E14 5AB', country: 'GB' },
      profile: {
        create: {
          occupation: 'Software Engineer',
          employer: 'Tech Corp Ltd.',
          annualIncome: 95000,
          preferredCurrency: 'GBP',
        },
      },
    },
  });
  console.log(`✅ Created demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  // ── Admin User ─────────────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin1234!', 12);
  await prisma.user.create({
    data: {
      email: 'admin@lumina.bank',
      firstName: 'Admin',
      lastName: 'Lumina',
      passwordHash: adminPasswordHash,
      phone: '+447911000001',
      role: 'ADMIN',
      tier: 'PREMIUM',
      kycStatus: 'VERIFIED',
      isEmailVerified: true,
      status: 'ACTIVE',
      profile: { create: { preferredCurrency: 'GBP' } },
    },
  });
  console.log('✅ Created admin user: admin@lumina.bank / Admin1234!');

  // ── Accounts ───────────────────────────────────────────────────────────────
  const currentAcc = await prisma.account.create({
    data: {
      userId: user.id, accountNumber: '45210876', iban: 'GB82LUMI20000045210876',
      sortCode: '20-00-00',
      type: AccountType.CURRENT, currency: 'GBP', balance: 12450.00, availableBalance: 12450.00, isDefault: true,
    },
  });

  const savingsAcc = await prisma.account.create({
    data: {
      userId: user.id, accountNumber: '78912345', iban: 'GB82LUMI20000078912345',
      sortCode: '20-00-00',
      type: AccountType.SAVINGS, currency: 'GBP', balance: 45200.00, availableBalance: 45200.00,
      interestRate: 0.0450,
    },
  });

  const businessAcc = await prisma.account.create({
    data: {
      userId: user.id, accountNumber: '33409871', iban: 'GB82LUMI20000033409871',
      sortCode: '20-00-00',
      type: AccountType.BUSINESS, currency: 'GBP', balance: 8900.00, availableBalance: 8900.00,
    },
  });
  console.log('✅ Created 3 accounts (current, savings, business)');

  // ── Generate 500 transactions ──────────────────────────────────────────────
  const transactionData: any[] = [];
  let runningBalance = 12450.00;
  let refCounter = 0;

  for (let i = 365; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const txsPerDay = Math.floor(Math.random() * 5);

    // Monthly salary on the 1st
    if (date.getDate() === 1) {
      const salary = 8500;
      const balBefore = runningBalance;
      runningBalance += salary;
      refCounter++;
      transactionData.push({
        reference: `LMN-${format(date, 'yyyyMMdd')}-SAL${String(refCounter).padStart(4, '0')}`,
        accountId: currentAcc.id,
        type: TransactionType.CREDIT,
        category: TransactionCategory.SALARY,
        amount: salary,
        currency: 'GBP',
        balanceBefore: balBefore,
        balanceAfter: runningBalance,
        description: 'Monthly salary — Tech Corp Ltd.',
        merchantName: 'Tech Corp Ltd.',
        counterpartyName: 'Tech Corp Ltd.',
        status: TransactionStatus.COMPLETED,
        valueDate: date,
        createdAt: date,
      });
    }

    for (let j = 0; j < txsPerDay; j++) {
      const merchant = randomFrom(MERCHANTS);
      const amount = randomBetween(merchant.amount[0], merchant.amount[1]);
      const balBefore = runningBalance;
      runningBalance -= amount;
      if (runningBalance < 0) { runningBalance += amount; continue; }
      refCounter++;
      transactionData.push({
        reference: `LMN-${format(date, 'yyyyMMdd')}-${String(refCounter).padStart(6, '0')}`,
        accountId: currentAcc.id,
        type: TransactionType.DEBIT,
        category: TransactionCategory.CARD_PAYMENT,
        amount,
        currency: 'GBP',
        balanceBefore: balBefore,
        balanceAfter: runningBalance,
        description: merchant.name,
        merchantName: merchant.name,
        merchantCategory: merchant.category,
        status: TransactionStatus.COMPLETED,
        valueDate: date,
        createdAt: date,
      });
    }

    // Weekly grocery refund (5% chance)
    if (Math.random() < 0.05) {
      const refund = randomBetween(10, 50);
      const balBefore = runningBalance;
      runningBalance += refund;
      refCounter++;
      transactionData.push({
        reference: `LMN-${format(date, 'yyyyMMdd')}-RFD${String(refCounter).padStart(4, '0')}`,
        accountId: currentAcc.id,
        type: TransactionType.CREDIT,
        category: TransactionCategory.REFUND,
        amount: refund,
        currency: 'GBP',
        balanceBefore: balBefore,
        balanceAfter: runningBalance,
        description: 'Refund — Amazon',
        merchantName: 'Amazon',
        status: TransactionStatus.COMPLETED,
        valueDate: date,
        createdAt: date,
      });
    }
  }

  // Batch insert
  const batchSize = 100;
  for (let i = 0; i < transactionData.length; i += batchSize) {
    await prisma.transaction.createMany({ data: transactionData.slice(i, i + batchSize) });
  }
  console.log(`✅ Created ${transactionData.length} transactions`);

  // Sync current account balance to final runningBalance so it matches the last transaction's balanceAfter
  await prisma.account.update({
    where: { id: currentAcc.id },
    data: { balance: runningBalance, availableBalance: runningBalance },
  });
  console.log(`✅ Synced current account balance to £${runningBalance.toFixed(2)}`);

  // ── Cards ─────────────────────────────────────────────────────────────────
  await prisma.card.create({
    data: {
      userId: user.id, accountId: currentAcc.id,
      type: 'DEBIT', tier: 'PLATINUM',
      maskedPan: '4521', expiryMonth: 12, expiryYear: 2028,
      cardholderName: 'ALEX MORGAN',
      currency: 'GBP',
      spendingLimits: { daily: 10000, monthly: 50000, perTransaction: 5000 },
      controls: { online: true, contactless: true, international: true, atm: true },
      status: 'ACTIVE',
    },
  });

  await prisma.card.create({
    data: {
      userId: user.id, accountId: currentAcc.id,
      type: 'VIRTUAL', tier: 'STANDARD',
      maskedPan: '9847', expiryMonth: 6, expiryYear: 2027,
      cardholderName: 'ALEX MORGAN',
      currency: 'GBP', isVirtual: true,
      spendingLimits: { daily: 2000, monthly: 10000, perTransaction: 500 },
      controls: { online: true, contactless: false, international: true, atm: false },
      status: 'ACTIVE',
    },
  });
  console.log('✅ Created 2 cards (Platinum + Virtual)');

  // ── Beneficiaries ─────────────────────────────────────────────────────────
  const beneficiaries = [
    { nickname: 'Mum', accountName: 'Sarah Morgan', accountNumber: '12345678', bankName: 'Barclays', bankCode: 'BARC', country: 'GB', currency: 'GBP' },
    { nickname: 'Dad', accountName: 'Robert Morgan', accountNumber: '87654321', bankName: 'Lloyds Bank', bankCode: 'LOYD', country: 'GB', currency: 'GBP' },
    { nickname: 'Landlord', accountName: 'City Properties Ltd', accountNumber: '56789012', bankName: 'NatWest', bankCode: 'NWBK', country: 'GB', currency: 'GBP', isFavorite: true },
    { nickname: 'Business Partner', accountName: 'James Wilson', accountNumber: '34567890', bankName: 'HSBC UK', bankCode: 'HSBC', country: 'GB', currency: 'GBP' },
    { nickname: 'Paris Client', accountName: 'Dupont & Associates', accountNumber: '', bankName: 'BNP Paribas', bankCode: 'BNPP', iban: 'FR7630006000011234567890189', swiftCode: 'BNPAFRPPXXX', country: 'FR', currency: 'EUR', isFavorite: true },
  ];

  await prisma.beneficiary.createMany({ data: beneficiaries.map((b) => ({ ...b, userId: user.id })) });
  console.log('✅ Created 5 beneficiaries');

  // ── Savings Goals ─────────────────────────────────────────────────────────
  await prisma.savingsGoal.createMany({
    data: [
      { userId: user.id, name: 'Dream Vacation', targetAmount: 5000, currentAmount: 3400, emoji: '🏖️', status: GoalStatus.ACTIVE, targetDate: new Date('2026-12-01') },
      { userId: user.id, name: 'Emergency Fund', targetAmount: 20000, currentAmount: 9000, emoji: '🛡️', status: GoalStatus.ACTIVE },
      { userId: user.id, name: 'New Car', targetAmount: 35000, currentAmount: 10500, emoji: '🚗', status: GoalStatus.ACTIVE, targetDate: new Date('2027-06-01') },
    ],
  });
  console.log('✅ Created 3 savings goals');

  // ── Loan ──────────────────────────────────────────────────────────────────
  const loan = await prisma.loan.create({
    data: {
      userId: user.id,
      type: LoanType.PERSONAL,
      principalAmount: 15000,
      outstandingBalance: 10825.40,
      interestRate: 0.085,
      termMonths: 24,
      monthlyPayment: 682.41,
      nextPaymentDate: addDays(new Date(), 15),
      nextPaymentAmount: 682.41,
      status: 'ACTIVE',
      disbursedAt: subMonths(new Date(), 8),
    },
  });

  // 8 months of payments
  const loanPayments: any[] = [];
  for (let m = 8; m >= 1; m--) {
    const pDate = subMonths(new Date(), m);
    const interest = 10825.40 * (0.085 / 12);
    const principal = 682.41 - interest;
    loanPayments.push({
      loanId: loan.id, amount: 682.41, principalPortion: principal,
      interestPortion: interest, paymentDate: pDate, status: 'PAID',
    });
  }
  await prisma.loanPayment.createMany({ data: loanPayments });
  console.log('✅ Created loan with 8 payment history records');

  // ── Investment Portfolio ───────────────────────────────────────────────────
  const portfolio = await prisma.portfolio.create({
    data: { userId: user.id, name: 'My Portfolio', currency: 'GBP' },
  });

  const holdings = [
    { ticker: 'AAPL', assetType: AssetType.EQUITY, assetName: 'Apple Inc.', quantity: 50, averageCostBasis: 155.20 },
    { ticker: 'MSFT', assetType: AssetType.EQUITY, assetName: 'Microsoft Corp.', quantity: 20, averageCostBasis: 310.50 },
    { ticker: 'AMZN', assetType: AssetType.EQUITY, assetName: 'Amazon.com Inc.', quantity: 15, averageCostBasis: 140.75 },
    { ticker: 'GOOGL', assetType: AssetType.EQUITY, assetName: 'Alphabet Inc.', quantity: 10, averageCostBasis: 125.00 },
    { ticker: 'SPY', assetType: AssetType.ETF, assetName: 'SPDR S&P 500 ETF', quantity: 30, averageCostBasis: 430.00 },
    { ticker: 'BTC', assetType: AssetType.CRYPTO, assetName: 'Bitcoin', quantity: 0.5, averageCostBasis: 35000 },
    { ticker: 'ETH', assetType: AssetType.CRYPTO, assetName: 'Ethereum', quantity: 3, averageCostBasis: 2100 },
    { ticker: 'NVDA', assetType: AssetType.EQUITY, assetName: 'NVIDIA Corp.', quantity: 8, averageCostBasis: 380.00 },
  ];

  await prisma.investment.createMany({
    data: holdings.map((h) => ({ ...h, portfolioId: portfolio.id, currency: 'GBP', quantity: h.quantity.toString(), averageCostBasis: h.averageCostBasis.toString() })),
  });

  const watchlist = [
    { ticker: 'TSLA', assetName: 'Tesla Inc.', assetType: AssetType.EQUITY },
    { ticker: 'META', assetName: 'Meta Platforms Inc.', assetType: AssetType.EQUITY },
    { ticker: 'SOL', assetName: 'Solana', assetType: AssetType.CRYPTO },
  ];

  await prisma.watchlist.createMany({
    data: watchlist.map((w) => ({ ...w, portfolioId: portfolio.id })),
  });
  console.log('✅ Created investment portfolio with 8 holdings + 3 watchlist items');

  // ── Notifications ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: user.id, type: 'TRANSACTION', title: 'Salary received', body: '£8,500.00 salary credited to your Current Account', isRead: false, createdAt: new Date() },
      { userId: user.id, type: 'SECURITY', title: 'New login detected', body: 'Login from Chrome on Windows — London, GB', isRead: false, createdAt: subDays(new Date(), 1) },
      { userId: user.id, type: 'SYSTEM', title: 'Statement ready', body: 'Your June 2026 statement is now available for download', isRead: true, createdAt: subDays(new Date(), 5) },
      { userId: user.id, type: 'TRANSFER', title: 'Transfer sent', body: '£500.00 sent to Landlord — City Properties Ltd', isRead: true, createdAt: subDays(new Date(), 7) },
      { userId: user.id, type: 'LOAN', title: 'Payment due soon', body: 'Your loan payment of £682.41 is due in 15 days', isRead: false, createdAt: subDays(new Date(), 2) },
      { userId: user.id, type: 'MARKETING', title: 'Upgrade to Lumina Private', body: 'Unlock exclusive benefits with our Private Banking tier', isRead: true, createdAt: subDays(new Date(), 10) },
    ],
  });
  console.log('✅ Created 6 notifications');

  console.log('\n🎉 Seed complete!');
  console.log('──────────────────────────────────────');
  console.log(`📧 Email: ${DEMO_EMAIL}`);
  console.log(`🔑 Password: ${DEMO_PASSWORD}`);
  console.log('──────────────────────────────────────');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
