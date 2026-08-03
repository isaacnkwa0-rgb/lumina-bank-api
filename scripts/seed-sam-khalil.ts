/**
 * Seed 5-year realistic transaction history for Sam Khalil.
 * Profile: Chief Operating Officer at Guardian Vault Ltd. (London gold custody & storage).
 * High earner, family man, London-based, dense daily weekday transactions.
 * Target balance: £946,800 ≈ $1.2M USD.
 *
 * Run: DATABASE_URL="<prod_url>" npx tsx scripts/seed-sam-khalil.ts
 */

import {
  PrismaClient,
  TransactionType,
  TransactionCategory,
  TransactionStatus,
} from '@prisma/client';
import { subDays, format, getDate, getMonth, getDay } from 'date-fns';

const prisma = new PrismaClient();

const SAM_EMAIL    = 'samkhalill200@gmail.com';
const TARGET_BAL   = 946800;
const START_BAL    = 165000;
const DAYS         = 5 * 365;

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
let _c = 0;
function ref(date: Date, tag: string) {
  return `LMN-${format(date, 'yyyyMMdd')}-${tag}${String(++_c).padStart(5, '0')}`;
}

// ── Merchant catalogues ───────────────────────────────────────────────────────

const COFFEE = [
  { name: 'Grind — Canary Wharf',        min: 3.90, max: 7.50 },
  { name: 'Blank Street Coffee — E14',   min: 3.50, max: 6.80 },
  { name: 'Pret a Manger — Canada Sq',   min: 4.20, max: 8.50 },
  { name: 'Costa Coffee — Cabot Place',  min: 3.80, max: 6.50 },
  { name: 'Notes Coffee Roasters',        min: 4.50, max: 7.20 },
  { name: 'Starbucks — One Canada Sq',   min: 4.00, max: 7.00 },
  { name: 'Kaffeine — Fitzrovia',        min: 3.90, max: 6.80 },
];

const BUSINESS_LUNCH = [
  { name: 'Hawksmoor — Wood Wharf',      min: 85,  max: 320 },
  { name: 'Boisdale of Canary Wharf',    min: 95,  max: 380 },
  { name: 'Roka — Canary Wharf',         min: 90,  max: 290 },
  { name: 'The Ivy — Canary Wharf',      min: 75,  max: 260 },
  { name: 'Plateau Restaurant — E14',    min: 70,  max: 220 },
  { name: 'Gaucho — Canary Wharf',       min: 80,  max: 300 },
  { name: 'The Gun Pub — Docklands',     min: 45,  max: 140 },
  { name: 'Roti Chai — Portman Square',  min: 40,  max: 120 },
];

const CASUAL_LUNCH = [
  { name: 'Deliveroo — Wasabi Sushi',      min: 12, max: 22 },
  { name: 'Deliveroo — Leon Canary Wharf', min: 10, max: 18 },
  { name: 'Deliveroo — Itsu E14',          min: 11, max: 20 },
  { name: 'Pret a Manger — Canada Sq',     min: 8,  max: 14 },
  { name: 'Subway — Canary Wharf',         min: 7,  max: 13 },
  { name: 'Eat. — South Quay',             min: 9,  max: 16 },
];

const EVENING_DINING = [
  { name: 'Nobu — Berkeley Street',        min: 180, max: 520 },
  { name: 'The OXO Tower Restaurant',      min: 160, max: 440 },
  { name: 'Oblix — The Shard',             min: 200, max: 580 },
  { name: 'Chiltern Firehouse',            min: 180, max: 500 },
  { name: 'Berner\'s Tavern — Fitzrovia',  min: 140, max: 380 },
  { name: 'The River Café — Hammersmith',  min: 190, max: 520 },
  { name: 'Gymkhana — Mayfair',            min: 150, max: 420 },
  { name: '34 Mayfair',                    min: 160, max: 450 },
  { name: 'Sketch — Mayfair',             min: 150, max: 400 },
  { name: 'Boisdale of Belgravia',         min: 130, max: 360 },
  { name: 'Hawksmoor — Air Street',        min: 120, max: 340 },
  { name: 'Scott\'s — Mayfair',            min: 160, max: 440 },
];

const FAMILY_DINING = [
  { name: 'Pizza Express — Canary Wharf', min: 45,  max: 120 },
  { name: 'Prezzo — Isle of Dogs',        min: 50,  max: 130 },
  { name: 'Wahaca — Canary Wharf',        min: 55,  max: 140 },
  { name: 'Bella Italia — Canary Wharf',  min: 48,  max: 125 },
  { name: 'Giraffe — Cabot Place',        min: 60,  max: 145 },
  { name: 'Nando\'s — Canary Wharf',      min: 40,  max: 100 },
];

const TRANSPORT = [
  { name: 'TfL Oyster Top-Up',            min: 20,  max: 50  },
  { name: 'Uber — Canary Wharf',          min: 12,  max: 45  },
  { name: 'Addison Lee — City of London', min: 35,  max: 90  },
  { name: 'NCP Parking — Cabot Square',   min: 15,  max: 40  },
  { name: 'Q-Park — Canary Wharf',        min: 12,  max: 35  },
  { name: 'Uber — Mayfair to E14',        min: 18,  max: 55  },
];

const PETROL = [
  'Shell Garage — East India Dock Rd',
  'BP — Limehouse',
  'Shell — Blackwall Tunnel Approach',
  'Esso — Commercial Road E1',
];

const SHOPPING = [
  { name: 'John Lewis — Oxford St',       min: 80,  max: 850  },
  { name: 'Selfridges — Oxford Street',   min: 120, max: 1200 },
  { name: 'Hugo Boss — Canary Wharf',     min: 150, max: 650  },
  { name: 'Reiss — Canary Wharf',         min: 120, max: 480  },
  { name: 'Paul Smith — Westfield',       min: 180, max: 750  },
  { name: 'Amazon UK',                    min: 18,  max: 280  },
  { name: 'Apple Store — Stratford',      min: 299, max: 2199 },
  { name: 'Harrods — Knightsbridge',      min: 180, max: 1600 },
  { name: 'Charles Tyrwhitt — City',      min: 90,  max: 320  },
  { name: 'Fenwick Bond Street',          min: 150, max: 900  },
];

const GROCERIES = [
  { name: 'Waitrose — Canada Square E14', min: 90,  max: 260 },
  { name: 'Ocado — Home Delivery',        min: 110, max: 300 },
  { name: 'M&S Food — Cabot Place',       min: 60,  max: 180 },
  { name: 'Sainsbury\'s — East India',    min: 70,  max: 190 },
];

const GYM = [
  { name: 'Equinox — Canada Square',       min: 280, max: 280 }, // monthly membership
  { name: 'Third Space — Canary Wharf',    min: 250, max: 250 },
];

const GOLD_INDUSTRY = [
  { name: 'LBMA Annual Conference — Registration',       min: 1800, max: 3200  },
  { name: 'World Gold Council Forum — Delegate Pass',    min: 1200, max: 2400  },
  { name: 'Swiss Precious Metals Summit — Zurich',       min: 2500, max: 4500  },
  { name: 'Dubai Gold & Commodities Exchange — Summit',  min: 2200, max: 3800  },
  { name: 'Singapore Precious Metals Conference',        min: 2000, max: 3500  },
  { name: 'Kitco News — Premium Subscription',           min:  199, max:  199  },
  { name: 'Metals Focus — Market Intelligence',          min: 4500, max: 6500  },
  { name: 'World Gold Council — Annual Membership',      min: 3500, max: 5000  },
];

const BUSINESS_TRAVEL_FLIGHTS = [
  { name: 'British Airways — LHR to ZRH Business',        min:  650, max: 1400 },
  { name: 'Swiss Air — LHR to GVA Business',              min:  580, max: 1250 },
  { name: 'Emirates — LHR to DXB Business',               min:  980, max: 2200 },
  { name: 'Singapore Airlines — LHR to SIN Business',     min: 1800, max: 4200 },
  { name: 'British Airways — LHR to JFK Business',        min: 1600, max: 3800 },
  { name: 'Qantas — LHR to SYD Business (HQ Visit)',      min: 3800, max: 7500 }, // Sydney HQ
  { name: 'Qantas — LHR to MEL Business (AU Conference)', min: 3600, max: 7200 }, // Melbourne
  { name: 'Virgin Australia — SYD to PER Perth Mint',     min:  480, max: 980  }, // Perth Mint visit
  { name: 'Lufthansa — LHR to FRA Business',              min:  480, max: 1100 },
];

const BUSINESS_HOTELS = [
  { name: 'The Dolder Grand — Zurich',            min: 580,  max: 1200 },
  { name: 'Four Seasons — Geneva',                min: 620,  max: 1350 },
  { name: 'Burj Al Arab — Dubai',                 min: 1200, max: 2600 },
  { name: 'Mandarin Oriental — Singapore',        min: 520,  max: 1050 },
  { name: 'The Peninsula — New York',             min: 700,  max: 1500 },
  { name: 'Park Hyatt Sydney — Circular Quay',   min: 580,  max: 1300 }, // Sydney HQ trips
  { name: 'Crown Towers Melbourne',              min: 520,  max: 1150 }, // Melbourne
  { name: 'COMO The Treasury — Perth',           min: 420,  max: 950  }, // Perth Mint visits
];

const FAMILY_ACTIVITIES = [
  { name: 'Legoland Windsor — Family Tickets',          min: 140, max: 220 },
  { name: 'Natural History Museum — Membership',        min: 85,  max: 85  },
  { name: 'Vue Cinema — IMAX Family',                   min: 55,  max: 90  },
  { name: 'Kidzania London',                            min: 100, max: 160 },
  { name: 'Thorpe Park — Family Tickets',               min: 160, max: 240 },
  { name: 'Royal Academy of Arts',                      min: 40,  max: 80  },
  { name: 'ZSL London Zoo — Family Pass',               min: 90,  max: 130 },
];

const HOLIDAY_FLIGHTS = [
  { name: 'British Airways — LHR to PMI Mallorca',      min: 280, max: 680 },
  { name: 'British Airways — LHR to MXP Milan',         min: 320, max: 750 },
  { name: 'EasyJet — LGW to BCN Barcelona',             min: 180, max: 480 },
  { name: 'Emirates — LHR to MLE Maldives',             min: 1400, max: 3200 },
  { name: 'Swiss Air — LGW to GVA Verbier Ski',         min: 350, max: 850 },
  { name: 'British Airways — LHR to FCO Rome',          min: 260, max: 620 },
];

const HOLIDAY_HOTELS = [
  { name: 'Hotel Formentor — Mallorca',                 min: 480, max: 1100 },
  { name: 'Villa d\'Este — Lake Como',                  min: 750, max: 1600 },
  { name: 'Conrad Maldives — Rangali Island',           min: 1200, max: 2800 },
  { name: 'W Verbier — Ski Resort',                     min: 680, max: 1500 },
  { name: 'Hotel de Russie — Rome',                     min: 540, max: 1100 },
  { name: 'Arts Hotel — Barcelona',                     min: 420, max: 850  },
];

const WELLNESS = [
  { name: 'ESPA Life at Corinthia London',   min: 180, max: 480 },
  { name: 'Bamford Wellness Spa',             min: 150, max: 380 },
  { name: 'The Bulgari Spa — London',         min: 200, max: 500 },
  { name: 'Boots Pharmacy — Cabot Place',    min: 15,  max: 85  },
  { name: 'Bupa Private GP — Canary Wharf', min: 180, max: 280 },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Looking up Sam Khalil in production database...');

  const user = await prisma.user.findUnique({
    where: { email: SAM_EMAIL },
    include: { accounts: true },
  });

  if (!user) {
    console.error(`❌  "${SAM_EMAIL}" not found in the database.`);
    process.exit(1);
  }

  console.log(`✅ Found: ${user.firstName} ${user.lastName} (${user.email})`);
  console.log(`   Tier: ${user.tier}  |  Accounts: ${user.accounts.length}`);

  // Upgrade tier to PRIVATE for a high-net-worth individual
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

  const { count: removed } = await prisma.transaction.deleteMany({ where: { accountId: account.id } });
  console.log(`🗑  Cleared ${removed} existing transaction(s)`);

  // ── Transaction generation ────────────────────────────────────────────────
  const txs: any[] = [];
  let bal = START_BAL;
  const today = new Date();

  function debit(date: Date, tag: string, amount: number, opts: {
    category?: TransactionCategory;
    description: string;
    merchantName?: string;
    merchantCategory?: string;
    counterpartyName?: string;
    counterpartyBank?: string;
  }) {
    if (bal - amount < 5000) return;
    const before = bal;
    bal = Math.round((bal - amount) * 100) / 100;
    txs.push({
      reference: ref(date, tag),
      accountId: account.id,
      type: TransactionType.DEBIT,
      category: opts.category ?? TransactionCategory.CARD_PAYMENT,
      amount,
      currency: 'GBP',
      balanceBefore: before,
      balanceAfter: bal,
      description: opts.description,
      merchantName: opts.merchantName ?? opts.description.split(' — ')[0],
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
    counterpartyName?: string;
  }) {
    const before = bal;
    bal = Math.round((bal + amount) * 100) / 100;
    txs.push({
      reference: ref(date, tag),
      accountId: account.id,
      type: TransactionType.CREDIT,
      category: opts.category ?? TransactionCategory.TRANSFER,
      amount,
      currency: 'GBP',
      balanceBefore: before,
      balanceAfter: bal,
      description: opts.description,
      merchantName: null,
      merchantCategory: null,
      counterpartyName: opts.counterpartyName ?? null,
      counterpartyBank: null,
      status: TransactionStatus.COMPLETED,
      valueDate: date,
      createdAt: date,
    });
  }

  // ── Day loop (stops at yesterday; today is reserved for the balance adjustment) ──
  for (let i = DAYS; i >= 1; i--) {
    const date   = subDays(today, i);
    const dom    = getDate(date);
    const mon    = getMonth(date);   // 0-indexed
    const dow    = getDay(date);     // 0=Sun
    const isWknd = dow === 0 || dow === 6;
    const isWeekday = !isWknd;

    // ── INCOME ──────────────────────────────────────────────────────────────

    // Monthly net salary — 28th
    if (dom === 28) {
      credit(date, 'SAL', 22000, {
        category: TransactionCategory.SALARY,
        description: 'Monthly Net Pay — Guardian Vault Australia Pty Ltd. (London Office)',
        counterpartyName: 'Guardian Vault Australia Pty Ltd.',
      });
    }

    // Annual performance bonus — 20 January
    if (dom === 20 && mon === 0) {
      credit(date, 'BON', rand(45000, 95000), {
        category: TransactionCategory.SALARY,
        description: 'Annual Performance Bonus — Guardian Vault Australia Pty Ltd.',
        counterpartyName: 'Guardian Vault Australia Pty Ltd.',
      });
    }

    // Quarterly AUM-based bonus — 20th of Mar / Jun / Sep / Dec
    if (dom === 20 && [2, 5, 8, 11].includes(mon)) {
      credit(date, 'QBN', rand(12000, 28000), {
        category: TransactionCategory.SALARY,
        description: 'Quarterly AUC Bonus — Guardian Vault Australia Pty Ltd.',
        counterpartyName: 'Guardian Vault Australia Pty Ltd.',
      });
    }

    // New custody contract commission — irregular
    if (dom === 14 && [1, 4, 7, 10].includes(mon) && Math.random() < 0.65) {
      const clients = [
        'Al-Futtaim Group Custody Contract — GVA London',
        'Sovereign Wealth Fund Custody Deal — APAC Desk',
        'Swiss Family Office Onboarding — Guardian Vault AU',
        'Gulf Bullion Reserve New Mandate — GVA',
        'Asian Institutional Client Referral — Guardian Vault',
        'ANZ Bullion Custody — New Contract Commission',
        'Perth Mint Institutional Referral — GVA London',
      ];
      credit(date, 'COM', rand(8500, 22000), {
        description: `Client Referral Commission — ${pick(clients)}`,
        counterpartyName: 'Guardian Vault Ltd.',
      });
    }

    // Investment dividends — 1st of Mar / Jun / Sep / Dec
    if (dom === 1 && [2, 5, 8, 11].includes(mon)) {
      const sources = [
        'iShares Physical Gold ETC — Dividend',
        'Vanguard FTSE 100 ETF — Income',
        'WisdomTree Gold — Distribution',
        'Barrick Gold Corporation — Quarterly',
        'Newmont Corporation — Dividend',
      ];
      credit(date, 'DIV', rand(3000, 7200), {
        category: TransactionCategory.INTEREST,
        description: `Dividend — ${pick(sources)}`,
        counterpartyName: pick(sources).split(' — ')[0],
      });
    }

    // ── FIXED MONTHLY OUTGOINGS ────────────────────────────────────────────

    // Mortgage — 1st
    if (dom === 1) {
      debit(date, 'MRT', 4500, {
        category: TransactionCategory.PAYMENT,
        description: 'Monthly Mortgage — Nationwide Building Society',
        merchantName: 'Nationwide Building Society',
        counterpartyBank: 'Nationwide',
      });
    }

    // Private school fees (2 children) — 5th of Sep / Jan / Apr (termly)
    if (dom === 5 && [8, 0, 3].includes(mon)) {
      debit(date, 'SCH', rand(4100, 4800), {
        category: TransactionCategory.PAYMENT,
        description: 'Term Fees — The Leys School',
        merchantName: 'The Leys School',
        merchantCategory: 'Education',
      });
    }

    // Car lease (Range Rover Autobiography) — 3rd
    if (dom === 3) {
      debit(date, 'CAR', 1850, {
        category: TransactionCategory.PAYMENT,
        description: 'Monthly PCP Payment — Range Rover Autobiography',
        merchantName: 'Land Rover Financial Services',
        merchantCategory: 'Vehicle Finance',
      });
    }

    // Gym membership — 6th
    if (dom === 6) {
      const g = pick(GYM);
      debit(date, 'GYM', g.min, {
        category: TransactionCategory.PAYMENT,
        description: `${g.name} — Monthly Membership`,
        merchantName: g.name.split(' — ')[0],
        merchantCategory: 'Gym & Fitness',
      });
    }

    // Personal trainer — every other week (1st and 15th)
    if (dom === 1 || dom === 15) {
      debit(date, 'PTR', rand(80, 120), {
        category: TransactionCategory.PAYMENT,
        description: 'Personal Training Sessions — PT London',
        merchantName: 'PT London',
        merchantCategory: 'Fitness',
      });
    }

    // Mobile phone — 2nd
    if (dom === 2) {
      debit(date, 'MOB', 140, {
        category: TransactionCategory.PAYMENT,
        description: 'EE Business Mobile — Monthly Plan',
        merchantName: 'EE Business',
      });
    }

    // Broadband + Sky — 10th
    if (dom === 10) {
      debit(date, 'BRD', 95, {
        category: TransactionCategory.PAYMENT,
        description: 'BT Halo 3 — Monthly Broadband',
        merchantName: 'BT',
      });
      debit(date, 'SKY', 95, {
        category: TransactionCategory.PAYMENT,
        description: 'Sky Cinema & Sports — Monthly',
        merchantName: 'Sky',
      });
    }

    // Utilities — 8th
    if (dom === 8) {
      debit(date, 'GAS', rand(180, 360), {
        category: TransactionCategory.PAYMENT,
        description: 'British Gas — Energy Bill',
        merchantName: 'British Gas',
      });
    }

    // Council Tax — 7th
    if (dom === 7) {
      debit(date, 'CTX', 320, {
        category: TransactionCategory.PAYMENT,
        description: 'Council Tax — Tower Hamlets Borough Council',
        merchantName: 'Tower Hamlets Council',
      });
    }

    // Streaming services — 12th
    if (dom === 12) {
      debit(date, 'NFX', 17.99, {
        category: TransactionCategory.PAYMENT,
        description: 'Netflix Premium — Monthly',
        merchantName: 'Netflix',
        merchantCategory: 'Entertainment',
      });
      debit(date, 'APL', 36.95, {
        category: TransactionCategory.PAYMENT,
        description: 'Apple One Premier — Monthly',
        merchantName: 'Apple',
        merchantCategory: 'Technology',
      });
      debit(date, 'SPT', 11.99, {
        category: TransactionCategory.PAYMENT,
        description: 'Spotify Premium Family — Monthly',
        merchantName: 'Spotify',
        merchantCategory: 'Entertainment',
      });
    }

    // Bupa health insurance — 20th
    if (dom === 20) {
      debit(date, 'BUP', rand(380, 380), {
        category: TransactionCategory.PAYMENT,
        description: 'Bupa Family Health Insurance — Monthly Premium',
        merchantName: 'Bupa',
        merchantCategory: 'Health Insurance',
      });
    }

    // Kitco precious metals data — 22nd (annual, November)
    if (dom === 22 && mon === 10) {
      debit(date, 'KIT', 199, {
        category: TransactionCategory.PAYMENT,
        description: 'Kitco News — Annual Premium Subscription',
        merchantName: 'Kitco',
        merchantCategory: 'Market Data',
      });
    }

    // Metals Focus market intelligence — annual February
    if (dom === 15 && mon === 1) {
      debit(date, 'MFI', rand(4500, 6500), {
        category: TransactionCategory.PAYMENT,
        description: 'Metals Focus — Annual Precious Metals Intelligence Report',
        merchantName: 'Metals Focus',
        merchantCategory: 'Market Research',
      });
    }

    // World Gold Council membership — annual March
    if (dom === 1 && mon === 2) {
      debit(date, 'WGC', rand(3500, 5000), {
        category: TransactionCategory.PAYMENT,
        description: 'World Gold Council — Annual Corporate Membership',
        merchantName: 'World Gold Council',
        merchantCategory: 'Industry Membership',
      });
    }

    // ── WEEKDAY DAILY TRANSACTIONS ─────────────────────────────────────────

    if (isWeekday) {

      // Morning coffee — most weekdays
      if (Math.random() < 0.88) {
        const c = pick(COFFEE);
        debit(date, 'COF', rand(c.min, c.max), {
          description: c.name,
          merchantName: c.name.split(' — ')[0],
          merchantCategory: 'Coffee & Cafés',
        });
      }

      // Commute / transport — most weekdays
      if (Math.random() < 0.80) {
        const t = pick(TRANSPORT);
        debit(date, 'TRP', rand(t.min, t.max), {
          description: t.name,
          merchantName: t.name.split(' — ')[0],
          merchantCategory: 'Transport',
        });
      }

      // Lunch — mix of business and casual
      if (Math.random() < 0.72) {
        if (Math.random() < 0.40) {
          // Business lunch with client or colleague
          const r = pick(BUSINESS_LUNCH);
          const covers = Math.ceil(Math.random() * 3) + 1;
          debit(date, 'LCH', Math.round(rand(r.min, r.max) * covers * 100) / 100, {
            description: `${r.name} — Business Lunch`,
            merchantName: r.name.split(' — ')[0],
            merchantCategory: 'Business Dining',
          });
        } else {
          // Casual lunch or delivery
          const r = pick(CASUAL_LUNCH);
          debit(date, 'LCH', rand(r.min, r.max), {
            description: r.name,
            merchantName: r.name.split(' — ')[0],
            merchantCategory: 'Food & Drink',
          });
        }
      }

      // Evening — dining or drinks (35% of weeknights)
      if (Math.random() < 0.35) {
        const r = pick(EVENING_DINING);
        const covers = Math.ceil(Math.random() * 2) + 1;
        debit(date, 'EVE', Math.round(rand(r.min, r.max) * covers * 100) / 100, {
          description: r.name,
          merchantName: r.name.split(' — ')[0],
          merchantCategory: 'Restaurants & Dining',
        });
      }

      // Petrol (Range Rover fills, ~once per week on a weekday)
      if (dom % 7 === 2 && Math.random() < 0.75) {
        debit(date, 'PTL', rand(85, 140), {
          description: pick(PETROL),
          merchantName: pick(['Shell', 'BP', 'Esso']),
          merchantCategory: 'Petrol & Fuel',
        });
      }
    }

    // ── WEEKEND TRANSACTIONS ───────────────────────────────────────────────

    if (isWknd) {

      // Family grocery shop — most Saturdays
      if (dow === 6 && Math.random() < 0.85) {
        const g = pick(GROCERIES);
        debit(date, 'GRC', rand(g.min, g.max), {
          description: g.name,
          merchantName: g.name.split(' — ')[0],
          merchantCategory: 'Groceries',
        });
      }

      // Family dining — Saturday or Sunday evening
      if (Math.random() < 0.55) {
        const r = pick(FAMILY_DINING);
        debit(date, 'FAM', rand(r.min, r.max), {
          description: r.name,
          merchantName: r.name.split(' — ')[0],
          merchantCategory: 'Family Dining',
        });
      }

      // Family activity (weekend, ~30% of weekends)
      if (dow === 6 && Math.random() < 0.28) {
        const a = pick(FAMILY_ACTIVITIES);
        debit(date, 'ACT', rand(a.min, a.max), {
          description: a.name,
          merchantName: a.name.split(' — ')[0],
          merchantCategory: 'Family & Entertainment',
        });
      }

      // Golf or leisure (Sunday, 20%)
      if (dow === 0 && Math.random() < 0.20) {
        debit(date, 'GLF', rand(65, 180), {
          description: pick([
            'The Minster Club — Canary Wharf Golf',
            'Richmond Golf Club — Weekend Round',
            'Beckenham Place Park Golf',
            'The Falconwood Golf Club',
          ]),
          merchantName: 'Golf Club',
          merchantCategory: 'Golf & Sports',
        });
      }
    }

    // ── VARIABLE LIFESTYLE ─────────────────────────────────────────────────

    // Occasional shopping (3× / month roughly)
    if (Math.random() < 0.09) {
      const s = pick(SHOPPING);
      debit(date, 'SHP', rand(s.min, s.max), {
        description: s.name,
        merchantName: s.name.split(' — ')[0],
        merchantCategory: 'Shopping',
      });
    }

    // Wellness / pharmacy / GP
    if (Math.random() < 0.04) {
      const w = pick(WELLNESS);
      debit(date, 'WLN', rand(w.min, w.max), {
        description: w.name,
        merchantName: w.name.split(' — ')[0],
        merchantCategory: 'Health & Wellness',
      });
    }

    // ── GOLD INDUSTRY EVENTS (bi-annual, roughly) ──────────────────────────

    // LBMA Conference — October each year
    if (dom === 5 && mon === 9) {
      const evt = GOLD_INDUSTRY[0];
      debit(date, 'LBM', rand(evt.min, evt.max), {
        category: TransactionCategory.PAYMENT,
        description: evt.name,
        merchantName: 'LBMA',
        merchantCategory: 'Industry Conference',
      });
    }

    // Dubai Gold & Commodities Conference — March
    if (dom === 20 && mon === 2 && Math.random() < 0.7) {
      const evt = GOLD_INDUSTRY[3];
      debit(date, 'DGC', rand(evt.min, evt.max), {
        category: TransactionCategory.PAYMENT,
        description: evt.name,
        merchantName: 'DGCX',
        merchantCategory: 'Industry Conference',
      });
    }

    // ── BUSINESS TRAVEL (quarterly, to Zurich / Dubai / Singapore) ────────

    if (dom === 18 && [1, 5, 8, 11].includes(mon) && Math.random() < 0.65) {
      const flight = pick(BUSINESS_TRAVEL_FLIGHTS);
      debit(date, 'BFL', rand(flight.min, flight.max), {
        category: TransactionCategory.PAYMENT,
        description: flight.name,
        merchantName: flight.name.split(' — ')[0],
        merchantCategory: 'Business Travel',
      });
      // Hotel for 2-3 nights
      const hotel = pick(BUSINESS_HOTELS);
      const nights = Math.ceil(Math.random() * 2) + 1;
      debit(subDays(date, -1), 'BHT', Math.round(rand(hotel.min, hotel.max) * nights * 100) / 100, {
        description: `${hotel.name} — ${nights} Nights`,
        merchantName: hotel.name.split(' — ')[0],
        merchantCategory: 'Business Hotel',
      });
    }

    // ── FAMILY HOLIDAYS (3× per year — Summer / Christmas / Spring) ───────

    // Summer holiday flights — 1st August
    if (dom === 1 && mon === 7) {
      const fl = pick(HOLIDAY_FLIGHTS);
      debit(date, 'HFL', rand(fl.min, fl.max) * 4, { // family of 4
        category: TransactionCategory.PAYMENT,
        description: `${fl.name} — Family of 4`,
        merchantName: fl.name.split(' — ')[0],
        merchantCategory: 'Family Holiday',
      });
      const ht = pick(HOLIDAY_HOTELS);
      const nights = 7 + Math.floor(Math.random() * 7); // 7-14 nights
      debit(subDays(date, -2), 'HHT', Math.round(rand(ht.min, ht.max) * nights * 100) / 100, {
        description: `${ht.name} — ${nights} Nights Family`,
        merchantName: ht.name.split(' — ')[0],
        merchantCategory: 'Family Holiday',
      });
    }

    // Ski / Christmas break — 23rd December
    if (dom === 23 && mon === 11) {
      debit(date, 'HFL', rand(350, 850) * 4, {
        category: TransactionCategory.PAYMENT,
        description: 'Swiss Air — LGW to GVA Verbier Ski — Family of 4',
        merchantName: 'Swiss Air',
        merchantCategory: 'Family Holiday',
      });
      debit(subDays(date, -1), 'HHT', rand(700, 1600) * 7, {
        description: 'W Verbier Ski Resort — 7 Nights Family',
        merchantName: 'W Hotels',
        merchantCategory: 'Family Holiday',
      });
    }

    // Easter break — 1st April
    if (dom === 1 && mon === 3) {
      debit(date, 'HFL', rand(260, 650) * 4, {
        category: TransactionCategory.PAYMENT,
        description: 'British Airways — LHR to BCN Barcelona — Family of 4',
        merchantName: 'British Airways',
        merchantCategory: 'Family Holiday',
      });
      debit(subDays(date, -1), 'HHT', rand(420, 900) * 5, {
        description: 'Hotel Arts Barcelona — 5 Nights Family',
        merchantName: 'Hotel Arts',
        merchantCategory: 'Family Holiday',
      });
    }

    // ── ANNUAL SYDNEY HQ VISIT (Guardian Vault Australia — June) ──────────
    if (dom === 10 && mon === 5) {
      // Qantas business LHR-SYD
      debit(date, 'SYD', rand(3800, 7500), {
        category: TransactionCategory.PAYMENT,
        description: 'Qantas Business Class — LHR to SYD (Guardian Vault HQ Annual Review)',
        merchantName: 'Qantas Airways',
        merchantCategory: 'Business Travel',
      });
      // Park Hyatt Sydney for 5 nights
      debit(subDays(date, -2), 'PHY', rand(580, 1300) * 5, {
        description: 'Park Hyatt Sydney — 5 Nights (Guardian Vault HQ Visit)',
        merchantName: 'Park Hyatt Sydney',
        merchantCategory: 'Business Hotel',
      });
      // Internal flight to Perth Mint (50% chance)
      if (Math.random() < 0.5) {
        debit(subDays(date, -6), 'PER', rand(480, 980), {
          category: TransactionCategory.PAYMENT,
          description: 'Virgin Australia — SYD to PER (Perth Mint Partnership Meeting)',
          merchantName: 'Virgin Australia',
          merchantCategory: 'Business Travel',
        });
        debit(subDays(date, -7), 'PCT', rand(420, 950) * 2, {
          description: 'COMO The Treasury Perth — 2 Nights (Perth Mint Visit)',
          merchantName: 'COMO The Treasury',
          merchantCategory: 'Business Hotel',
        });
      }
    }

    // Australian Precious Metals Conference Melbourne (odd years, November)
    if (dom === 8 && mon === 10 && Math.random() < 0.45) {
      debit(date, 'APC', rand(3600, 7200), {
        category: TransactionCategory.PAYMENT,
        description: 'Qantas Business Class — LHR to MEL (Australian Precious Metals Conference)',
        merchantName: 'Qantas Airways',
        merchantCategory: 'Business Travel',
      });
      debit(subDays(date, -2), 'CTM', rand(520, 1150) * 3, {
        description: 'Crown Towers Melbourne — 3 Nights (AU Precious Metals Conference)',
        merchantName: 'Crown Towers Melbourne',
        merchantCategory: 'Business Hotel',
      });
      debit(subDays(date, -3), 'APR', rand(1800, 3200), {
        category: TransactionCategory.PAYMENT,
        description: 'Australian Precious Metals Forum — Delegate Registration',
        merchantName: 'AU Precious Metals Forum',
        merchantCategory: 'Industry Conference',
      });
    }

    // ── HOME INSURANCE (annual, September) ────────────────────────────────
    if (dom === 1 && mon === 8) {
      debit(date, 'HIN', rand(680, 980), {
        category: TransactionCategory.PAYMENT,
        description: 'Home & Contents Insurance — Aviva',
        merchantName: 'Aviva',
        merchantCategory: 'Insurance',
      });
    }

    // Car insurance (annual, July)
    if (dom === 15 && mon === 6) {
      debit(date, 'CIN', rand(1800, 2600), {
        category: TransactionCategory.PAYMENT,
        description: 'Comprehensive Car Insurance — Direct Line',
        merchantName: 'Direct Line',
        merchantCategory: 'Insurance',
      });
    }

    // Life insurance / income protection — monthly, 18th
    if (dom === 18) {
      debit(date, 'LIF', rand(280, 280), {
        category: TransactionCategory.PAYMENT,
        description: 'Life & Income Protection — Legal & General',
        merchantName: 'Legal & General',
        merchantCategory: 'Insurance',
      });
    }
  }

  // ── Final balance adjustment (dated TODAY — always the most recent transaction) ──
  const diff = TARGET_BAL - bal;

  if (diff > 0) {
    if (diff > 60000) {
      const half = Math.round(diff / 2 * 100) / 100;
      credit(today, 'ISA', half, {
        category: TransactionCategory.INTEREST,
        description: 'ISA Drawdown — Hargreaves Lansdown Stocks & Shares',
        counterpartyName: 'Hargreaves Lansdown',
      });
      credit(today, 'INV', diff - half, {
        category: TransactionCategory.INTEREST,
        description: 'Investment Liquidation — WisdomTree Gold ETC',
        counterpartyName: 'Hargreaves Lansdown',
      });
    } else {
      credit(today, 'INV', diff, {
        category: TransactionCategory.INTEREST,
        description: 'Investment Drawdown — Hargreaves Lansdown',
        counterpartyName: 'Hargreaves Lansdown',
      });
    }
  } else if (diff < 0) {
    const excess = Math.abs(diff);
    debit(today, 'ISA', excess, {
      category: TransactionCategory.INVESTMENT,
      description: 'ISA Top-Up Transfer — Hargreaves Lansdown Stocks & Shares',
      merchantName: 'Hargreaves Lansdown',
      counterpartyName: 'Hargreaves Lansdown',
    });
  }

  // ── Batch insert ──────────────────────────────────────────────────────────
  console.log(`\n📊 Inserting ${txs.length} transactions...`);
  const BATCH = 150;
  for (let i = 0; i < txs.length; i += BATCH) {
    await prisma.transaction.createMany({ data: txs.slice(i, i + BATCH) });
    process.stdout.write(`\r   Progress: ${Math.min(i + BATCH, txs.length)} / ${txs.length}`);
  }
  process.stdout.write('\n');

  // ── Update account balance ────────────────────────────────────────────────
  await prisma.account.update({
    where: { id: account.id },
    data: { balance: TARGET_BAL, availableBalance: TARGET_BAL },
  });

  console.log('\n✅ Done!');
  console.log('─────────────────────────────────────────────────');
  console.log(`💰 New balance : £${TARGET_BAL.toLocaleString()} (≈ $1.2M USD)`);
  console.log(`📊 Transactions: ${txs.length}`);
  console.log(`📅 Date range  : ${format(subDays(today, DAYS), 'dd MMM yyyy')} → ${format(today, 'dd MMM yyyy')}`);
  console.log('─────────────────────────────────────────────────');
}

main()
  .catch(e => { console.error('\n❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
