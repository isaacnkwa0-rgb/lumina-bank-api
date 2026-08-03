/**
 * Seed 5-year realistic transaction history for Garrett Ray.
 * Profile: Senior private charter pilot, heavy traveller, high net-worth.
 * Target balance: £946,800 ≈ $1.2M USD at 0.789 rate.
 *
 * Run: npx tsx scripts/seed-garrett-ray.ts
 */

import {
  PrismaClient,
  TransactionType,
  TransactionCategory,
  TransactionStatus,
} from '@prisma/client';
import { subDays, format, getDate, getMonth, getDay } from 'date-fns';

const prisma = new PrismaClient();

// ── Config ────────────────────────────────────────────────────────────────────
const TARGET_BALANCE = 946800;   // £946,800 ≈ $1.2 M
const START_BALANCE  = 420000;   // Starting balance 5 years ago
const DAYS           = 5 * 365;  // 1,825 days of history

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let _counter = 0;
function txRef(date: Date, tag: string): string {
  _counter++;
  return `LMN-${format(date, 'yyyyMMdd')}-${tag}${String(_counter).padStart(5, '0')}`;
}

// ── Merchant catalogues ───────────────────────────────────────────────────────
const FUEL_STOPS = [
  { name: 'Shell Aviation — EGLL Heathrow',           min: 1800, max: 3500 },
  { name: 'World Fuel Services — LFPG CDG Paris',     min: 1200, max: 2800 },
  { name: 'Avfuel Corporation — KJFK New York',       min: 2000, max: 4200 },
  { name: 'Shell Aviation — EHAM Amsterdam Schiphol', min: 1400, max: 2600 },
  { name: 'World Fuel Services — OMDB Dubai',         min: 2200, max: 4800 },
  { name: 'Signature Aviation Fuel — FAOR Johannesburg', min: 1800, max: 3200 },
  { name: 'Shell Aviation — WSSS Singapore Changi',   min: 2400, max: 5000 },
  { name: 'Avfuel Corporation — LSGG Geneva',         min: 1600, max: 3000 },
  { name: 'World Fuel Services — LEBL Barcelona',     min: 1000, max: 2200 },
  { name: 'Shell Aviation — EGKB Biggin Hill London', min:  900, max: 1800 },
  { name: 'Avfuel Corporation — MMUN Cancún',         min: 1500, max: 2900 },
  { name: 'World Fuel Services — FACT Cape Town',     min: 1800, max: 3400 },
];

const FBO_FEES = [
  { name: 'Signature Flight Support — EGLL Heathrow', min: 350, max:  800 },
  { name: 'Jet Aviation — LSGG Geneva',               min: 400, max:  950 },
  { name: 'Signature Flight Support — KJFK New York', min: 500, max: 1200 },
  { name: 'Universal Aviation — OMDB Dubai',          min: 600, max: 1400 },
  { name: 'Harrods Aviation — EGSS Stansted',         min: 280, max:  650 },
  { name: 'TAG Aviation — LFPB Le Bourget Paris',     min: 480, max:  980 },
  { name: 'Seletar Airport FBO — WSSL Singapore',     min: 550, max: 1100 },
  { name: 'Monarch Air & Charter — KFLL Fort Lauderdale', min: 450, max: 950 },
  { name: 'Inflite The Jet Centre — EGSS Stansted',   min: 300, max:  700 },
];

const EUROCONTROL_ROUTES = [
  'EGLL–LFPG',
  'EGLL–LSGG',
  'EGLL–LEBL',
  'EGLL–OMDB',
  'EGKB–LFMN Nice',
  'EGSS–LIRF Rome',
  'EGLL–EHAM',
  'EGLL–LEMD Madrid',
];

const HOTELS = [
  { name: 'Four Seasons Hotel — New York',          min:  680, max: 1400 },
  { name: 'Four Seasons DIFC — Dubai',              min:  580, max: 1200 },
  { name: 'Ritz Paris — Place Vendôme',             min:  950, max: 1900 },
  { name: 'Mandarin Oriental — Singapore',          min:  520, max: 1050 },
  { name: 'The Connaught — Mayfair London',         min:  780, max: 1500 },
  { name: 'One&Only Cape Town',                     min:  480, max:  980 },
  { name: 'Grand Hyatt Tokyo',                      min:  440, max:  880 },
  { name: 'Aman Venice — Palazzo Papadopoli',       min: 1100, max: 2400 },
  { name: 'St Regis Monte-Carlo',                   min:  820, max: 1700 },
  { name: 'Rosewood Hong Kong',                     min:  620, max: 1150 },
  { name: 'Burj Al Arab — Jumeirah Dubai',          min: 1250, max: 2900 },
  { name: 'Hotel Arts Barcelona — Marriott',        min:  420, max:  820 },
  { name: 'Brenners Park Hotel — Baden-Baden',      min:  580, max: 1100 },
  { name: 'Sandy Lane Hotel — Barbados',            min:  900, max: 1800 },
  { name: 'Gili Lankanfushi — Maldives',            min: 1400, max: 2800 },
];

const RESTAURANTS = [
  { name: 'Nobu — Mayfair London',               min: 180, max: 520 },
  { name: 'Gordon Ramsay Restaurant — Chelsea',   min: 220, max: 580 },
  { name: 'The Fat Duck — Bray',                  min: 280, max: 620 },
  { name: 'Hawksmoor — Seven Dials',              min: 120, max: 280 },
  { name: 'Sketch — Mayfair London',              min: 150, max: 380 },
  { name: 'Nobu — DIFC Dubai',                    min: 200, max: 500 },
  { name: 'Le Bernardin — New York',              min: 260, max: 580 },
  { name: 'Zuma Restaurant — Dubai',              min: 180, max: 440 },
  { name: 'Alain Ducasse — Plaza Athénée Paris',  min: 320, max: 720 },
  { name: 'Cut by Wolfgang Puck — Singapore',     min: 200, max: 460 },
  { name: 'Beefbar — Monte-Carlo',                min: 180, max: 420 },
  { name: 'Dinner by Heston Blumenthal — London', min: 210, max: 480 },
  { name: 'Scott\'s Restaurant — Mayfair',        min: 160, max: 360 },
  { name: 'Zuma — Knightsbridge London',          min: 190, max: 430 },
  { name: 'Sexy Fish — Mayfair',                  min: 140, max: 340 },
  { name: 'Cipriani — New York',                  min: 240, max: 520 },
];

const CHAUFFEUR = [
  { name: 'Addison Lee — Chauffeur London',      min:  80, max: 250 },
  { name: 'Blacklane — Dubai Airport Transfer',  min: 120, max: 300 },
  { name: 'Carey Limousine — New York',          min: 180, max: 380 },
  { name: 'Hertz Gold — International Rental',  min: 180, max: 450 },
  { name: 'Avis Preferred — Airport Rental',    min: 150, max: 380 },
  { name: 'Sixt Luxury — Geneva',               min: 200, max: 480 },
  { name: 'Uber Black — London',                min:  45, max: 130 },
  { name: 'Hertz Gold — Singapore Changi',      min: 160, max: 380 },
];

const SHOPPING = [
  { name: 'Brioni — Savile Row London',        min: 1200, max: 4800 },
  { name: 'Turnbull & Asser — Jermyn Street',  min:  350, max: 1200 },
  { name: 'Apple Store — Regent Street',       min:  299, max: 2499 },
  { name: 'Harrods — Knightsbridge',           min:  200, max: 1800 },
  { name: 'Fortnum & Mason — Piccadilly',      min:   80, max:  350 },
  { name: 'Amazon UK',                         min:   30, max:  350 },
  { name: 'Selfridges — Oxford Street',        min:  150, max:  650 },
  { name: 'Berry Bros & Rudd — St James\'s',   min:  180, max:  800 },
  { name: 'Aspinal of London — Mayfair',       min:  280, max:  950 },
  { name: 'Rolex Boutique — Bond Street',      min: 6500, max:22000 },  // rare
];

const GOLF_CLUBS = [
  'Wentworth Club — West Course',
  'Sunningdale Golf Club',
  'The Grove Golf Club',
  'Queenwood Golf Club',
  'Royal St George\'s Golf Club',
];

const MAINTENANCE_SHOPS = [
  'Gama Aviation MRO — Farnborough',
  'Citation Service Centre — Farnborough',
  'Signature MRO — EGSS Stansted',
  'Duncan Aviation — Lincoln NE USA',
  'West Star Aviation — Grand Junction',
];

const TRAINING_CENTRES = [
  'FlightSafety International — Wichita',
  'CAE Oxford Aviation Academy',
  'SimuFlite Training International',
  'SIMCOM Aviation Training — Orlando',
];

const GARRETT_EMAIL = 'garrettray44454@gmail.com';

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Looking up Garrett Ray in production database...');

  const user = await prisma.user.findUnique({
    where: { email: GARRETT_EMAIL },
    include: { accounts: true },
  });

  if (!user) {
    console.error(`❌  "${GARRETT_EMAIL}" not found in the database.`);
    process.exit(1);
  }

  console.log(`✅ Found: ${user.firstName} ${user.lastName} (${user.email})`);
  console.log(`   Tier: ${user.tier}  |  Accounts: ${user.accounts.length}`);

  // Upgrade tier to PRIVATE to reflect wealth level
  await prisma.user.update({
    where: { id: user.id },
    data: { tier: 'PRIVATE' },
  });
  console.log('✅ Tier upgraded to PRIVATE');

  const account = user.accounts.find(a => a.isDefault) ?? user.accounts[0];
  if (!account) {
    console.error('❌  No accounts found for this user.');
    process.exit(1);
  }

  console.log(`✅ Target account: ${account.accountNumber} (${account.type}) — current balance: £${Number(account.balance).toLocaleString()}`);

  // Clear existing transactions for this account only
  const { count: removed } = await prisma.transaction.deleteMany({ where: { accountId: account.id } });
  console.log(`🗑  Cleared ${removed} existing transaction(s)`);

  // ── Generate 5 years of transactions ───────────────────────────────────────
  const txs: any[] = [];
  let bal = START_BALANCE;
  const today = new Date();

  function debit(date: Date, tag: string, amount: number, opts: {
    category?: TransactionCategory;
    description: string;
    merchantName?: string;
    merchantCategory?: string;
    counterpartyName?: string;
    counterpartyBank?: string;
  }) {
    if (bal - amount < 10000) return; // safety floor
    const before = bal;
    bal = Math.round((bal - amount) * 100) / 100;
    txs.push({
      reference: txRef(date, tag),
      accountId: account.id,
      type: TransactionType.DEBIT,
      category: opts.category ?? TransactionCategory.CARD_PAYMENT,
      amount,
      currency: 'GBP',
      balanceBefore: before,
      balanceAfter: bal,
      description: opts.description,
      merchantName: opts.merchantName ?? opts.description,
      merchantCategory: opts.merchantCategory ?? null,
      counterpartyName: opts.counterpartyName ?? null,
      counterpartyBank: opts.counterpartyBank ?? null,
      status: TransactionStatus.COMPLETED,
      valueDate: date,
      createdAt: date,
    });
  }

  function credit(date: Date, tag: string, amount: number, opts: {
    category?: TransactionCategory;
    description: string;
    merchantName?: string;
    counterpartyName?: string;
  }) {
    const before = bal;
    bal = Math.round((bal + amount) * 100) / 100;
    txs.push({
      reference: txRef(date, tag),
      accountId: account.id,
      type: TransactionType.CREDIT,
      category: opts.category ?? TransactionCategory.TRANSFER,
      amount,
      currency: 'GBP',
      balanceBefore: before,
      balanceAfter: bal,
      description: opts.description,
      merchantName: opts.merchantName ?? null,
      merchantCategory: null,
      counterpartyName: opts.counterpartyName ?? opts.merchantName ?? null,
      counterpartyBank: null,
      status: TransactionStatus.COMPLETED,
      valueDate: date,
      createdAt: date,
    });
  }

  // ── Day loop (stops at yesterday; today is reserved for the balance adjustment) ──
  for (let i = DAYS; i >= 1; i--) {
    const date  = subDays(today, i);
    const dom   = getDate(date);    // 1–31
    const mon   = getMonth(date);   // 0–11
    const dow   = getDay(date);     // 0=Sun … 6=Sat
    const isWknd = dow === 0 || dow === 6;

    // ── INCOME ────────────────────────────────────────────────────────────────

    // Net salary — 25th of each month
    if (dom === 25) {
      credit(date, 'SAL', 18500, {
        category: TransactionCategory.SALARY,
        description: 'Net Pay — Prestige Air Charter Ltd.',
        counterpartyName: 'Prestige Air Charter Ltd.',
      });
    }

    // Annual performance bonus — 15 January
    if (dom === 15 && mon === 0) {
      credit(date, 'BON', rand(28000, 45000), {
        category: TransactionCategory.SALARY,
        description: 'Annual Performance Bonus — Prestige Air Charter Ltd.',
        counterpartyName: 'Prestige Air Charter Ltd.',
      });
    }

    // Quarterly flight-hours bonus — 15 Mar / Jun / Sep / Dec
    if (dom === 15 && [2, 5, 8, 11].includes(mon)) {
      credit(date, 'QBN', rand(8500, 14500), {
        category: TransactionCategory.SALARY,
        description: 'Quarterly Flight Hours Bonus — Prestige Air Charter Ltd.',
        counterpartyName: 'Prestige Air Charter Ltd.',
      });
    }

    // Private charter revenue — irregular (bi-monthly, 70% hit rate)
    if (dom === 8 && [0, 2, 4, 6, 8, 10].includes(mon) && Math.random() < 0.70) {
      const destinations = [
        'Caribbean VIP Run', 'Maldives Charter', 'Monaco Grand Prix',
        'Cannes Film Festival', 'Swiss Alps Ski Season', 'Amalfi Coast',
        'Ibiza Season Charter', 'Mykonos Run', 'Sardinia Summer',
        'Dubai World Cup',
      ];
      credit(date, 'CHT', rand(7500, 24000), {
        description: `Private Charter Revenue — ${pick(destinations)}`,
        counterpartyName: 'Prestige Air Charter Ltd.',
      });
    }

    // Investment dividends — 1st Mar / Jun / Sep / Dec
    if (dom === 1 && [2, 5, 8, 11].includes(mon)) {
      const sources = [
        'Vanguard FTSE All-World ETF',
        'iShares Core MSCI World ETF',
        'Diageo Plc — Interim Dividend',
        'Royal Dutch Shell Plc — Quarterly',
        'HSBC Holdings Plc — Dividend',
      ];
      credit(date, 'DIV', rand(3500, 8500), {
        category: TransactionCategory.INTEREST,
        description: `Dividend Receipt — ${pick(sources)}`,
        counterpartyName: pick(sources),
      });
    }

    // ── FIXED MONTHLY OUTGOINGS ───────────────────────────────────────────────

    // Mortgage — 1st
    if (dom === 1) {
      debit(date, 'MRT', 3850, {
        category: TransactionCategory.PAYMENT,
        description: 'Monthly Mortgage — Halifax Mortgage Services',
        merchantName: 'Halifax Mortgage Services',
        counterpartyBank: 'Halifax',
      });
    }

    // Hangar lease — 3rd
    if (dom === 3) {
      debit(date, 'HNG', 1400, {
        category: TransactionCategory.PAYMENT,
        description: 'Monthly Hangar Lease — Fairoaks Aviation Centre',
        merchantName: 'Fairoaks Aviation Centre',
      });
    }

    // EE Business mobile — 2nd
    if (dom === 2) {
      debit(date, 'MOB', 120, {
        category: TransactionCategory.PAYMENT,
        description: 'EE Business Mobile — Monthly Plan',
        merchantName: 'EE Business',
      });
    }

    // Council tax — 5th
    if (dom === 5) {
      debit(date, 'CTX', 280, {
        category: TransactionCategory.PAYMENT,
        description: 'Council Tax — Royal Borough of Kensington and Chelsea',
        merchantName: 'RBKC Council',
      });
    }

    // British Gas — 8th
    if (dom === 8) {
      debit(date, 'GAS', rand(160, 320), {
        category: TransactionCategory.PAYMENT,
        description: 'British Gas — Monthly Energy Bill',
        merchantName: 'British Gas',
      });
    }

    // BT Broadband + Sky — 10th
    if (dom === 10) {
      debit(date, 'BTB', 65, {
        category: TransactionCategory.PAYMENT,
        description: 'BT Business Broadband — Monthly',
        merchantName: 'BT Business',
      });
      debit(date, 'SKY', 85, {
        category: TransactionCategory.PAYMENT,
        description: 'Sky Cinema & Sports — Monthly Subscription',
        merchantName: 'Sky',
      });
    }

    // Thames Water — 14th
    if (dom === 14) {
      debit(date, 'WAT', 88, {
        category: TransactionCategory.PAYMENT,
        description: 'Thames Water — Quarterly Direct Debit',
        merchantName: 'Thames Water',
      });
    }

    // Netflix + Apple One — 15th
    if (dom === 15) {
      debit(date, 'NFX', 17.99, {
        category: TransactionCategory.PAYMENT,
        description: 'Netflix Premium — Monthly',
        merchantName: 'Netflix',
        merchantCategory: 'Entertainment',
      });
      debit(date, 'APL', 36.95, {
        category: TransactionCategory.PAYMENT,
        description: 'Apple One Premier — Monthly Subscription',
        merchantName: 'Apple',
        merchantCategory: 'Technology',
      });
    }

    // Wentworth Club membership — 20th
    if (dom === 20) {
      debit(date, 'WGC', 380, {
        category: TransactionCategory.PAYMENT,
        description: 'Wentworth Club — Monthly Membership Dues',
        merchantName: 'Wentworth Club',
      });
    }

    // ── ANNUAL FIXED AVIATION COSTS ───────────────────────────────────────────

    // ForeFlight annual — 1 February
    if (dom === 1 && mon === 1) {
      debit(date, 'FFL', 299, {
        category: TransactionCategory.PAYMENT,
        description: 'ForeFlight Pro Plus — Annual Subscription Renewal',
        merchantName: 'ForeFlight Ltd.',
        merchantCategory: 'Aviation Software',
      });
    }

    // Jeppesen NavData — 1 March
    if (dom === 1 && mon === 2) {
      debit(date, 'JPP', 1850, {
        category: TransactionCategory.PAYMENT,
        description: 'Jeppesen JeppView & NavData Charts — Annual Renewal',
        merchantName: 'Jeppesen GmbH',
        merchantCategory: 'Aviation Navigation',
      });
    }

    // Aviation hull & liability insurance — 1 April
    if (dom === 1 && mon === 3) {
      debit(date, 'INS', rand(13500, 19500), {
        category: TransactionCategory.PAYMENT,
        description: 'Aircraft Hull & Liability Insurance — Global Aerospace',
        merchantName: 'Global Aerospace',
        merchantCategory: 'Insurance',
      });
    }

    // Recurrency / simulator training — April 12 and October 12
    if (dom === 12 && [3, 9].includes(mon)) {
      debit(date, 'TRN', rand(3800, 7800), {
        category: TransactionCategory.PAYMENT,
        description: `Type Rating Recurrency & Sim Check — ${pick(TRAINING_CENTRES)}`,
        merchantName: pick(TRAINING_CENTRES),
        merchantCategory: 'Aviation Training',
      });
    }

    // Aircraft quarterly maintenance — 18th of Feb / May / Aug / Nov
    if (dom === 18 && [1, 4, 7, 10].includes(mon)) {
      debit(date, 'MRO', rand(3800, 14000), {
        category: TransactionCategory.PAYMENT,
        description: `Aircraft Scheduled Maintenance — ${pick(MAINTENANCE_SHOPS)}`,
        merchantName: pick(MAINTENANCE_SHOPS),
        merchantCategory: 'Aircraft Maintenance',
      });
    }

    // ── VARIABLE AVIATION EXPENSES ────────────────────────────────────────────

    // Aviation fuel (≈ 2×/week personal aircraft + charter layovers)
    if (Math.random() < 0.14) {
      const f = pick(FUEL_STOPS);
      debit(date, 'AVF', rand(f.min, f.max), {
        description: f.name,
        merchantName: f.name.split(' — ')[0],
        merchantCategory: 'Aviation Fuel',
      });
    }

    // FBO handling fees
    if (Math.random() < 0.09) {
      const f = pick(FBO_FEES);
      debit(date, 'FBO', rand(f.min, f.max), {
        description: f.name,
        merchantName: f.name.split(' — ')[0],
        merchantCategory: 'FBO Services',
      });
    }

    // Eurocontrol route service charges
    if (Math.random() < 0.08) {
      debit(date, 'EUR', rand(280, 960), {
        category: TransactionCategory.PAYMENT,
        description: `Eurocontrol Route Service Charges — ${pick(EUROCONTROL_ROUTES)}`,
        merchantName: 'Eurocontrol CRCO',
        merchantCategory: 'Air Traffic Services',
      });
    }

    // ── TRAVEL & LIFESTYLE ────────────────────────────────────────────────────

    // Hotel stays — frequent traveller (avg ≈ 7 nights/month)
    if (Math.random() < 0.22) {
      const h = pick(HOTELS);
      const nights = Math.ceil(Math.random() * 3); // 1–3 nights
      const amount = Math.round(rand(h.min, h.max) * nights * 100) / 100;
      debit(date, 'HTL', amount, {
        description: `${h.name} — ${nights} Night${nights > 1 ? 's' : ''}`,
        merchantName: h.name.split(' — ')[0],
        merchantCategory: 'Hotels & Accommodation',
      });
    }

    // Fine dining
    if (Math.random() < 0.32) {
      const r = pick(RESTAURANTS);
      const covers = Math.ceil(Math.random() * 3); // 1–3 covers
      const amount = Math.round(rand(r.min, r.max) * covers * 100) / 100;
      debit(date, 'RST', amount, {
        description: r.name,
        merchantName: r.name.split(' — ')[0],
        merchantCategory: 'Restaurants & Dining',
      });
    }

    // Chauffeurs / car rental at destinations
    if (Math.random() < 0.18) {
      const t = pick(CHAUFFEUR);
      debit(date, 'TRP', rand(t.min, t.max), {
        description: t.name,
        merchantName: t.name.split(' — ')[0],
        merchantCategory: 'Ground Transport',
      });
    }

    // Shopping (luxury retail + everyday)
    if (Math.random() < 0.07) {
      // Rolex only once in a blue moon (~2% of all shopping picks)
      const pool = Math.random() < 0.02
        ? SHOPPING
        : SHOPPING.filter(s => !s.name.includes('Rolex'));
      const s = pick(pool);
      debit(date, 'SHP', rand(s.min, s.max), {
        description: s.name,
        merchantName: s.name.split(' — ')[0],
        merchantCategory: 'Shopping',
      });
    }

    // Waitrose / M&S groceries — most Saturdays
    if (dom % 7 === 6 && Math.random() < 0.80) {
      const grocer = Math.random() < 0.65 ? 'Waitrose — Kensington' : 'M&S Food — Kensington High St';
      debit(date, 'GRC', rand(95, 240), {
        description: grocer,
        merchantName: grocer.split(' — ')[0],
        merchantCategory: 'Groceries',
      });
    }

    // Golf — weekends (~25% of weekend days)
    if (isWknd && Math.random() < 0.25) {
      debit(date, 'GLF', rand(85, 280), {
        description: `${pick(GOLF_CLUBS)} — Green Fees & Clubhouse`,
        merchantName: pick(GOLF_CLUBS),
        merchantCategory: 'Golf & Sports',
      });
    }

    // ── OCCASIONAL EXTRAS ─────────────────────────────────────────────────────

    // Champagne / fine wine (Berry Bros, Fortnum's cellar)
    if (Math.random() < 0.04) {
      debit(date, 'WNE', rand(180, 850), {
        description: pick([
          'Berry Bros & Rudd — Wine & Spirits',
          'Fortnum & Mason — Cellar Reserve',
          'The Wine Society — Case Order',
          'Hedonism Wines — Mayfair',
        ]),
        merchantName: pick(['Berry Bros & Rudd', 'Fortnum & Mason', 'Hedonism Wines']),
        merchantCategory: 'Wine & Spirits',
      });
    }

    // Spa / wellness (hotel spa or standalone)
    if (Math.random() < 0.03) {
      debit(date, 'SPA', rand(120, 480), {
        description: pick([
          'ESPA Life at Corinthia — Spa Treatment',
          'The Bulgari Spa — London',
          'Four Seasons Spa — Mayfair',
          'Bamford Wellness Spa — Daylesford',
        ]),
        merchantName: pick(['ESPA Life', 'Bulgari Spa', 'Bamford Wellness']),
        merchantCategory: 'Health & Wellness',
      });
    }

    // Theatre / cultural events
    if (Math.random() < 0.025 && isWknd) {
      debit(date, 'EVT', rand(80, 380), {
        description: pick([
          'Royal Opera House — Covent Garden',
          'National Theatre — London',
          'Ronnie Scott\'s Jazz Club',
          'The Roundhouse — Camden',
          'O2 Arena — Premium Tickets',
        ]),
        merchantName: pick(['Royal Opera House', 'National Theatre', 'Ronnie Scott\'s']),
        merchantCategory: 'Entertainment & Events',
      });
    }
  }

  // ── Final balance adjustment (dated TODAY — always the most recent transaction) ──
  const diff = TARGET_BALANCE - bal;

  if (diff > 0) {
    if (diff > 50000) {
      const half = Math.round(diff / 2 * 100) / 100;
      credit(today, 'PRT', half, {
        description: 'Property Rental Income — Kensington Portfolio Q2',
        counterpartyName: 'Knight Frank Estate Agents',
      });
      credit(today, 'INV', diff - half, {
        category: TransactionCategory.INTEREST,
        description: 'Investment Drawdown — Hargreaves Lansdown ISA',
        counterpartyName: 'Hargreaves Lansdown',
      });
    } else {
      credit(today, 'INV', diff, {
        category: TransactionCategory.INTEREST,
        description: 'Investment Drawdown — Hargreaves Lansdown ISA',
        counterpartyName: 'Hargreaves Lansdown',
      });
    }
  } else if (diff < 0) {
    debit(today, 'ISA', Math.abs(diff), {
      category: TransactionCategory.INVESTMENT,
      description: 'ISA Top-Up Transfer — Hargreaves Lansdown',
      merchantName: 'Hargreaves Lansdown',
      counterpartyName: 'Hargreaves Lansdown',
    });
  }

  // ── Batch insert ────────────────────────────────────────────────────────────
  console.log(`\n📊 Inserting ${txs.length} transactions...`);
  const batchSize = 150;
  for (let i = 0; i < txs.length; i += batchSize) {
    await prisma.transaction.createMany({ data: txs.slice(i, i + batchSize) });
    process.stdout.write(
      `\r   Progress: ${Math.min(i + batchSize, txs.length)} / ${txs.length}`,
    );
  }
  process.stdout.write('\n');

  // ── Update account balance ──────────────────────────────────────────────────
  await prisma.account.update({
    where: { id: account.id },
    data: { balance: TARGET_BALANCE, availableBalance: TARGET_BALANCE },
  });

  console.log('\n✅ Done!');
  console.log('─────────────────────────────────────────────────');
  console.log(`💰 New balance : £${TARGET_BALANCE.toLocaleString()} (≈ $1.2 M USD)`);
  console.log(`📊 Transactions: ${txs.length}`);
  console.log(`📅 Date range  : ${format(subDays(today, DAYS), 'dd MMM yyyy')} → ${format(today, 'dd MMM yyyy')}`);
  console.log('─────────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error('\n❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
