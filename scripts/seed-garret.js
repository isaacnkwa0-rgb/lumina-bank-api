/**
 * Seed realistic transaction history for Garret Ray
 * Senior Captain, American Airlines (777/787 widebody, international routes)
 * Born 1993-02-01 | Based: New York, JFK | Account: GBP
 * Investment firm: Quantal Investment Ltd (consistent monthly returns)
 * Target ending balance: £1,970,000 | Period: Jan 2020 – Jul 2026
 *
 * Transactions are generated then sorted by valueDate so the
 * balanceBefore/balanceAfter chain is chronologically accurate.
 */

'use strict';

const { Pool } = require('pg');
const crypto = require('crypto');

const DB_URL     = 'postgresql://postgres:QhnWOAKrkUMXMiImOsmSQTofrexxVmFz@tokaido.proxy.rlwy.net:38103/railway';
const ACCOUNT_ID = '78a91d1d-0c63-4a21-80ec-623251903b6c';
const USER_ID    = 'dc93c4a7-b4e4-444a-bff6-a28717a6f7e2';
const TARGET_BALANCE = 1_970_000.00;

// Opening deposit: personal savings on account opening Jan 1 2020
// (adjusted lower to offset the higher AA senior-captain salary)
const OPENING_DEPOSIT = 106_913.41;

const pool = new Pool({ connectionString: DB_URL, ssl: false });

// ── helpers ────────────────────────────────────────────────────────────────

function uid() { return crypto.randomUUID(); }

let refCounter = 1;
function ref(pfx) {
  const n = String(refCounter++).padStart(6, '0');
  return `${pfx}-${n}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function vary(y, m, idx, min, max) {
  const h = crypto.createHash('md5').update(`${y}|${m}|${idx}`).digest();
  const r = h.readUInt32BE(0) / 0xFFFFFFFF;
  return Math.round((min + r * (max - min)) * 100) / 100;
}

function dt(y, mo, d, h = 9, mi = 0) {
  return new Date(Date.UTC(y, mo - 1, d, h, mi));
}
function lastDay(y, m) { return new Date(y, m, 0).getDate(); }
function safe(y, m, d) { return Math.min(d, lastDay(y, m)); }

// ── raw transaction accumulator (no balance yet) ───────────────────────────

const raw = []; // will be sorted by valueDate before balance calc

function add(type, category, amount, desc, date, opts = {}) {
  raw.push({
    id:                        uid(),
    type,
    category,
    amount:                    Math.abs(amount),
    currency:                  'GBP',
    description:               desc,
    merchantName:              opts.merchant   || null,
    merchantCategory:          opts.mcat       || null,
    counterpartyName:          opts.cpty       || null,
    counterpartyAccountNumber: opts.cptyAcc    || null,
    counterpartyBank:          opts.cptyBank   || null,
    status:                    'COMPLETED',
    metadata:                  opts.meta       || null,
    valueDate:                 date,
    createdAt:                 date,
  });
}

// ── destinations ───────────────────────────────────────────────────────────

const intlDests = [
  { city:'London',    hotel:'HILTON LONDON HEATHROW',        dining:['THE WOLSELEY LONDON','DISHOOM COVENT GARDEN','SKETCH LONDON'],              pd:210 },
  { city:'Dubai',     hotel:'MARRIOTT MARQUIS DUBAI',         dining:['NUSR-ET DUBAI','ZUMA DUBAI DIFC','NOBU HOTEL DUBAI'],                      pd:280 },
  { city:'Tokyo',     hotel:'GRAND HYATT TOKYO SHINJUKU',     dining:['RAMEN ICHIRAN SHIBUYA','TSUKIJI OUTER MARKET SUSHI','ROBATAYA TOKYO'],     pd:260 },
  { city:'Paris',     hotel:'PULLMAN PARIS MONTPARNASSE',     dining:['BRASSERIE LIPP PARIS','CAFE DE FLORE ST GERMAIN','SEPTIME PARIS'],         pd:230 },
  { city:'Singapore', hotel:'MARINA BAY SANDS SINGAPORE',     dining:['ODETTE SINGAPORE','LAVO SINGAPORE','NEWTON FOOD CENTRE'],                  pd:270 },
  { city:'Sydney',    hotel:'PARK HYATT SYDNEY HARBOUR',      dining:['QUAY RESTAURANT SYDNEY','ROCKPOOL BAR & GRILL SYDNEY','ARIA SYDNEY'],      pd:240 },
  { city:'Frankfurt', hotel:'STEIGENBERGER AIRPORT HOTEL FRA',dining:['METROPOL FRANKFURT','GOETHE RESTAURANT FRANKFURT','LOHNINGER FRANKFURT'],  pd:195 },
  { city:'São Paulo', hotel:'TIVOLI MOFARREJ SAO PAULO',      dining:['DOM RESTAURANT SAO PAULO','A FIGUEIRA RUBAIYAT','SPOT SAO PAULO'],         pd:220 },
];
const intlShops = {
  London:'SELFRIDGES LONDON', Dubai:'DUBAI MALL BOUTIQUES', Tokyo:'GINZA SIX TOKYO',
  Paris:'GALERIES LAFAYETTE PARIS', Singapore:'ION ORCHARD SINGAPORE',
  Sydney:'QVB SYDNEY SHOPPING', Frankfurt:'ZEIL GALLERIA FRANKFURT',
  'São Paulo':'SHOPPING IGUATEMI SAO PAULO',
};

function destA(y, m) { return intlDests[(y * 12 + m)     % intlDests.length]; }
function destB(y, m) { return intlDests[(y * 12 + m + 3) % intlDests.length]; }

// ── Quantal monthly return table ───────────────────────────────────────────

function quantalMonthly(y) {
  return { 2020:1_800, 2021:2_600, 2022:3_500, 2023:5_200, 2024:7_100, 2025:9_400, 2026:11_800 }[y] ?? 1_800;
}
const quantalTopUp = { 2021:25_000, 2022:40_000, 2023:65_000, 2024:90_000, 2025:120_000 };

// ── OPENING DEPOSIT ────────────────────────────────────────────────────────

add('CREDIT','DEPOSIT', OPENING_DEPOSIT,
  'Opening Balance – Personal Savings & Family Trust Transfer',
  dt(2020, 1, 1, 0, 0),
  { merchant:'LUMINA BANK OPENING TRANSFER', cpty:'Garret Ray – Personal Funds', cptyBank:'JPMorgan Chase' });

// ── month generator ────────────────────────────────────────────────────────

function genMonth(y, m) {
  const isGrounded = (y === 2020 && m >= 4 && m <= 6);
  const isReduced  = (y === 2020 && m >= 7 && m <= 9);
  const isRecovery = (y === 2020 && m >= 10) || (y === 2021 && m <= 6);

  // ── SALARY – AA Senior Captain, widebody 777/787 international ──
  // 2025 AA contract: ~$400/hr × 80hrs + intl premiums ≈ £32–40k/mo net
  let salary;
  if      (y === 2020 && m <= 3) salary = 32_000;   // pre-COVID full pay
  else if (isGrounded)           salary = 19_200;   // 60% pay – CARES Act furlough
  else if (isReduced)            salary = 24_000;   // 75% restored
  else if (isRecovery)           salary = 28_000;   // ramp-up
  else if (y === 2021 && m <= 6) salary = 30_000;   // recovery
  else if (y === 2021)           salary = 31_500;
  else if (y === 2022)           salary = 33_000;
  else if (y === 2023)           salary = 35_000;
  else if (y === 2024)           salary = 37_000;
  else if (y === 2025)           salary = 38_500;
  else                           salary = 40_000;   // 2026

  add('CREDIT','SALARY', salary,
    'Salary – Captain G. Ray, AA Fleet 777/787',
    dt(y, m, 15, 6, 30),
    { merchant:'AMERICAN AIRLINES PAYROLL', cpty:'American Airlines Inc.', cptyBank:'Citibank N.A.' });

  add('DEBIT','PAYMENT', 102,
    'Air Line Pilots Association – Monthly Dues',
    dt(y, m, 15, 6, 45),
    { merchant:'ALPA INTERNATIONAL', cpty:'Air Line Pilots Association' });

  // ── QUANTAL INVESTMENT LTD – MONTHLY RETURN ──
  const qBase = quantalMonthly(y);
  const qRtn  = Math.round(qBase * vary(y, m, 200, 0.94, 1.06) * 100) / 100;
  add('CREDIT','INVESTMENT', qRtn,
    'Monthly Investment Return – Quantal Investment Ltd',
    dt(y, m, 25, 8, 0),
    { merchant:'QUANTAL INVESTMENT LTD', cpty:'Quantal Investment Ltd', cptyBank:'Barclays Bank PLC',
      cptyAcc:'GB29BARC20711430926819',
      meta: JSON.stringify({ fund:'Quantal Global Growth Fund', nav: (qRtn / 0.04).toFixed(2) }) });

  // Annual capital top-up into Quantal (January each year)
  if (m === 1 && quantalTopUp[y]) {
    add('DEBIT','INVESTMENT', quantalTopUp[y],
      `Capital Contribution – Quantal Global Growth Fund FY${y}`,
      dt(y, 1, 8, 10, 0),
      { merchant:'QUANTAL INVESTMENT LTD', cpty:'Quantal Investment Ltd', cptyBank:'Barclays Bank PLC',
        cptyAcc:'GB29BARC20711430926819' });
  }

  // ── PER DIEMS ──
  if (!isGrounded) {
    const dA    = destA(y, m);
    const dB    = destB(y, m);
    const daysA = isReduced ? 3 : vary(y, m, 50, 3, 5);
    const daysB = isReduced ? 2 : vary(y, m, 51, 3, 5);
    add('CREDIT','SALARY', Math.round(dA.pd * daysA),
      `Intl Per Diem – ${dA.city} Layover (${daysA} day${daysA > 1 ? 's' : ''})`,
      dt(y, m, 20, 7, 0),
      { merchant:'AA INTERNATIONAL OPS – PER DIEM', cpty:'American Airlines Inc.' });
    add('CREDIT','SALARY', Math.round(dB.pd * daysB),
      `Intl Per Diem – ${dB.city} Layover (${daysB} day${daysB > 1 ? 's' : ''})`,
      dt(y, m, 20, 7, 10),
      { merchant:'AA INTERNATIONAL OPS – PER DIEM', cpty:'American Airlines Inc.' });
  }

  if (y === 2020 && m === 4) {
    add('CREDIT','DEPOSIT', 950, 'US Government Economic Impact Payment – IRS', dt(2020, 4, 15, 10, 0), { merchant:'US DEPT OF TREASURY IRS', cpty:'U.S. Treasury' });
  }

  const bonuses = { 2020:10_000, 2021:15_000, 2022:22_000, 2023:25_000, 2024:28_000, 2025:32_000 };
  if (m === 12 && bonuses[y]) {
    add('CREDIT','SALARY', bonuses[y], `Annual Performance Bonus – FY${y}`, dt(y, 12, 20, 6, 30), { merchant:'AMERICAN AIRLINES PAYROLL', cpty:'American Airlines Inc.' });
  }

  // ── MORTGAGE (owns apartment, Apt 21F Upper West Side, NYC) ──
  // 30-yr fixed at 3.25%, bought 2019 – monthly P&I + escrow
  const mortgage = y >= 2024 ? 3_150 : 3_050;
  add('DEBIT','PAYMENT', mortgage,
    'Mortgage Payment – Apt 21F, Upper West Side, New York',
    dt(y, m, 1, 8, 0),
    { merchant:'JPMORGAN CHASE HOME LOANS', cpty:'JPMorgan Chase Bank N.A.', counterpartyBank:'JPMorgan Chase' });

  // HOA / Building Common Charges
  const hoa = y >= 2023 ? 975 : 850;
  add('DEBIT','PAYMENT', hoa,
    'HOA Common Charges – Residential Condo Association NYC',
    dt(y, m, 2, 9, 0),
    { merchant:'UPPER WEST SIDE CONDO ASSOCIATION', cpty:'UWS Condo Assoc Management' });

  // NYC Property Tax – paid quarterly (Jan, Apr, Jul, Oct)
  if (m === 1 || m === 4 || m === 7 || m === 10) {
    const propTax = y >= 2023 ? 3_400 : 3_100;
    add('DEBIT','PAYMENT', propTax,
      'NYC Property Tax – Quarterly Instalment',
      dt(y, m, 3, 10, 0),
      { merchant:'NYC DEPT OF FINANCE – PROPERTY TAX', cpty:'City of New York' });
  }

  // ── BMW FINANCE (until end of 2024) ──
  if (y < 2025 || (y === 2025 && m < 3)) {
    add('DEBIT','PAYMENT', y >= 2022 ? 975 : 950,
      y >= 2022 ? 'BMW 750i M Sport – Finance Instalment' : 'BMW 540i xDrive – Finance Instalment',
      dt(y, m, 5, 9, 0),
      { merchant:'BMW FINANCIAL SERVICES NA LLC', cpty:'BMW Financial Services' });
  }

  // ── SUBSCRIPTIONS ──
  add('DEBIT','CARD_PAYMENT', 15.99, 'Netflix Premium',    dt(y, m,  1, 0,  5), { merchant:'NETFLIX.COM',               mcat:'Entertainment' });
  add('DEBIT','CARD_PAYMENT',  9.99, 'Spotify Premium',    dt(y, m,  3, 0,  5), { merchant:'SPOTIFY AB',                mcat:'Entertainment' });
  add('DEBIT','CARD_PAYMENT', 14.99, 'Amazon Prime',       dt(y, m,  3, 0,  7), { merchant:'AMAZON PRIME',              mcat:'Subscription'  });
  add('DEBIT','CARD_PAYMENT', 28.99, 'Apple One Premier',  dt(y, m, 20, 0,  5), { merchant:'APPLE.COM/BILL',            mcat:'Entertainment' });
  if (y >= 2021) {
    add('DEBIT','CARD_PAYMENT', 15.99, 'HBO Max – Monthly',dt(y, m,  5, 0, 10), { merchant:'HBO MAX WARNERBROSDISCOVERY',mcat:'Entertainment' });
  }
  if (m === 1) {
    add('DEBIT','PAYMENT', 389, 'Jeppesen NavData Annual Subscription', dt(y, 1, 10, 9, 0), { merchant:'JEPPESEN SANDERSON INC', mcat:'Aviation' });
  }

  // ── GYM ──
  if (!isGrounded) {
    add('DEBIT','PAYMENT', y >= 2023 ? 195 : 175, 'Equinox Fitness – Monthly Membership', dt(y, m, 8, 7, 0), { merchant:'EQUINOX FITNESS MIDTOWN', mcat:'Health & Fitness' });
  }

  // ── INSURANCE ──
  add('DEBIT','PAYMENT', 385, 'Cigna – Health Insurance Premium',      dt(y, m, 10, 9,  0), { merchant:'CIGNA HEALTHCARE'         });
  add('DEBIT','PAYMENT', 128, 'Allstate – Auto Insurance Premium',     dt(y, m, 12, 9,  0), { merchant:'ALLSTATE INSURANCE CO'    });
  add('DEBIT','PAYMENT',  94, 'Northwestern Mutual – Life Insurance',  dt(y, m, 14, 9,  0), { merchant:'NORTHWESTERN MUTUAL LIFE' });
  if (y >= 2025) {
    add('DEBIT','PAYMENT', 195, 'Allstate – Tesla Model S Insurance',  dt(y, m, 12, 9, 10), { merchant:'ALLSTATE INSURANCE CO'    });
  }

  // ── UTILITIES ──
  add('DEBIT','PAYMENT', vary(y, m, 10, 130, 220), 'Con Edison – Electric Service NYC', dt(y, m, 18, 9, 0), { merchant:'CON EDISON COMPANY OF NY' });
  add('DEBIT','PAYMENT', 92, 'Verizon Wireless – Monthly Plan',       dt(y, m, 22, 9, 0), { merchant:'VERIZON WIRELESS' });

  if (m === 4 || m === 10) {
    add('DEBIT','PAYMENT', 285, 'FAA Aviation Medical Exam – Class 1 Certificate', dt(y, m, safe(y, m, 7), 10, 0), { merchant:'FAA AVIATION MEDICAL CENTER', mcat:'Medical' });
  }

  // ── GROCERIES ──
  if (!isGrounded) {
    add('DEBIT','CARD_PAYMENT', vary(y, m, 20, 145, 268), 'Whole Foods Market – Grocery',  dt(y, m, safe(y, m,  6), 17, vary(y,m,70,0,59)|0), { merchant:'WHOLE FOODS MARKET COLUMBUS CIRCLE', mcat:'Groceries' });
    add('DEBIT','CARD_PAYMENT', vary(y, m, 21,  85, 162), "Trader Joe's – Weekly Shop",    dt(y, m, safe(y, m, 13), 12, vary(y,m,71,0,59)|0), { merchant:"TRADER JOE'S NYC UPPER WEST SIDE",  mcat:'Groceries' });
    if ((y * 12 + m) % 3 === 0) {
      add('DEBIT','CARD_PAYMENT', vary(y, m, 22, 180, 345), 'FreshDirect – Grocery Delivery', dt(y, m, safe(y, m, 24), 10, 0), { merchant:'FRESHDIRECT LLC', mcat:'Groceries' });
    }
  } else {
    add('DEBIT','CARD_PAYMENT', vary(y, m, 20, 250, 400), 'Amazon Fresh – Grocery Delivery', dt(y, m,  6, 10, 0), { merchant:'AMAZON FRESH',  mcat:'Groceries' });
    add('DEBIT','CARD_PAYMENT', vary(y, m, 21, 190, 370), 'Instacart – Grocery Delivery',    dt(y, m, 16, 11, 0), { merchant:'INSTACART INC', mcat:'Groceries' });
  }

  // ── DINING ──
  const casual  = ["SHAKE SHACK UPPER WEST SIDE","JOE'S PIZZA BLEECKER ST","FIVE GUYS 42ND ST","GREY'S PAPAYA NYC","DELI ON RYE NYC"];
  const midtier = ['THE SMITH LINCOLN CENTER','TAO UPTOWN NYC','BALTHAZAR RESTAURANT NYC','LOCANDA VERDE TRIBECA','IL MULINO NEW YORK'];
  const fine    = ['LE BERNARDIN NEW YORK','NOBU NEW YORK 57TH','CARBONE GREENWICH VILLAGE','AQUAGRILL SOHO','MAREA CENTRAL PARK SOUTH'];

  if (!isGrounded) {
    for (let i = 0; i < 3; i++) {
      const mer = casual[(y * m + i) % casual.length];
      add('DEBIT','CARD_PAYMENT', vary(y, m, 30 + i, 22, 68), `Lunch – ${mer}`, dt(y, m, safe(y, m, 4 + i * 7), 13, vary(y,m,80+i,0,59)|0), { merchant:mer, mcat:'Restaurants' });
    }
    for (let i = 0; i < 2; i++) {
      const mer = midtier[(y * m + i * 3) % midtier.length];
      add('DEBIT','CARD_PAYMENT', vary(y, m, 40 + i, 88, 198), `Dinner – ${mer}`, dt(y, m, safe(y, m, 10 + i * 9), 20, vary(y,m,90+i,0,59)|0), { merchant:mer, mcat:'Restaurants' });
    }
    if (!isRecovery || m % 2 === 0) {
      const mer = fine[(y * m * 7) % fine.length];
      add('DEBIT','CARD_PAYMENT', vary(y, m, 45, 195, 425), `Dinner – ${mer}`, dt(y, m, safe(y, m, 22), 19, 30), { merchant:mer, mcat:'Fine Dining' });
    }
    for (let i = 0; i < (vary(y, m, 55, 2, 4)|0); i++) {
      add('DEBIT','CARD_PAYMENT', vary(y, m, 56 + i, 7, 17), 'Starbucks – Coffee', dt(y, m, safe(y, m, 3 + i * 8), 7, 15 + i * 20), { merchant:'STARBUCKS MIDTOWN NYC', mcat:'Coffee' });
    }
  } else {
    add('DEBIT','CARD_PAYMENT', vary(y, m, 30, 35, 78), 'Seamless – Food Delivery', dt(y, m,  8, 19,  0), { merchant:'SEAMLESS INC',  mcat:'Food Delivery' });
    add('DEBIT','CARD_PAYMENT', vary(y, m, 31, 28, 55), 'Uber Eats – Food Delivery',dt(y, m, 15, 19, 30), { merchant:'UBER EATS',     mcat:'Food Delivery' });
    add('DEBIT','CARD_PAYMENT', vary(y, m, 32, 18, 45), 'DoorDash – Food Delivery', dt(y, m, 22, 18, 45), { merchant:'DOORDASH INC', mcat:'Food Delivery'  });
  }

  // ── ENTERTAINMENT ──
  if (!isGrounded && !isReduced) {
    const ents = [
      { mer:'NEW YORK YANKEES TICKET OFFICE', desc:'NY Yankees – Game Tickets',  min:148, max:355 },
      { mer:'MADISON SQUARE GARDEN',          desc:'MSG – Event Tickets',        min:118, max:295 },
      { mer:'BROADWAY DIRECT TICKETING',      desc:'Broadway Show – Tickets',    min:132, max:285 },
      { mer:'AMC THEATERS 84TH ST NYC',       desc:'AMC Cinemas – Movie Night',  min: 22, max: 55 },
    ];
    const e = ents[(y * m * 3) % ents.length];
    add('DEBIT','CARD_PAYMENT', vary(y, m, 60, e.min, e.max), e.desc, dt(y, m, safe(y, m, 18), 19, 0), { merchant:e.mer, mcat:'Entertainment' });
  }

  // ── RETAIL SHOPPING ──
  const shops = ['BLOOMINGDALES 59TH ST NYC','NORDSTROM NYC','SAKS FIFTH AVENUE NYC','AMAZON.COM'];
  if (!isGrounded) {
    add('DEBIT','CARD_PAYMENT', vary(y, m, 65, 148, 665), `Shopping – ${shops[(y*m)%shops.length]}`, dt(y, m, safe(y, m, 16), 14, vary(y,m,100,0,59)|0), { merchant:shops[(y*m)%shops.length], mcat:'Retail' });
  } else {
    add('DEBIT','CARD_PAYMENT', vary(y, m, 65, 250, 860), 'Amazon.com – Online Purchase', dt(y, m, 12, 10, 0), { merchant:'AMAZON.COM', mcat:'Retail' });
  }

  // ── INTERNATIONAL LAYOVER ──
  if (!isGrounded) {
    const dA = destA(y, m);
    const dB = destB(y, m);
    add('DEBIT','FX', vary(y, m, 70, 162, 345), `Hotel – ${dA.hotel} (Personal Upgrade)`, dt(y, m, safe(y, m,  8), 15,  0), { merchant:dA.hotel, mcat:'Hotels',      meta:JSON.stringify({ city:dA.city, currency:dA.currency }) });
    add('DEBIT','FX', vary(y, m, 71,  52, 185), `Dining – ${dA.dining[(y+m)%dA.dining.length]}`,  dt(y, m, safe(y, m,  9), 20, 30), { merchant:dA.dining[(y+m)%dA.dining.length], mcat:'Restaurants', meta:JSON.stringify({ city:dA.city }) });
    add('DEBIT','FX', vary(y, m, 72,  38, 132), `Dining – ${dB.dining[(y*m)%dB.dining.length]}`,  dt(y, m, safe(y, m, 24), 19,  0), { merchant:dB.dining[(y*m)%dB.dining.length], mcat:'Restaurants', meta:JSON.stringify({ city:dB.city }) });
    if ((y * 12 + m) % 4 === 0) {
      add('DEBIT','FX', vary(y, m, 73, 118, 692), `Shopping – ${intlShops[dA.city]}`, dt(y, m, safe(y, m, 10), 14, 0), { merchant:intlShops[dA.city], mcat:'Retail', meta:JSON.stringify({ city:dA.city }) });
    }
  }

  // ── HOLIDAY SPENDING ──
  if (m === 11) {
    add('DEBIT','CARD_PAYMENT', vary(y, 11, 80, 445, 1_250), 'Black Friday – Holiday Shopping', dt(y, 11, 26, 10, 0), { merchant:'NORDSTROM NYC',               mcat:'Retail' });
  }
  if (m === 12) {
    add('DEBIT','CARD_PAYMENT', vary(y, 12, 81, 295, 760), 'Christmas Gifts – Amazon',             dt(y, 12, 10, 10, 0), { merchant:'AMAZON.COM',                  mcat:'Retail' });
    add('DEBIT','CARD_PAYMENT', vary(y, 12, 82, 178, 425), "Christmas Shopping – Bloomingdale's",  dt(y, 12, 14, 15, 0), { merchant:"BLOOMINGDALE'S 59TH ST NYC",   mcat:'Retail' });
  }

  // ── PERSONAL SUMMER HOLIDAYS ──
  if (y >= 2021 && (m === 6 || m === 7) && !isGrounded) {
    const vDest  = m === 6 ? 'Maldives' : 'Amalfi Coast, Italy';
    const vHotel = m === 6 ? 'FOUR SEASONS RESORT MALDIVES' : 'HOTEL SANTA CATERINA AMALFI';
    add('DEBIT','CARD_PAYMENT', vary(y, m, 95, 1_800, 3_600), `Personal Vacation – ${vHotel}`,           dt(y, m, 12, 14, 0), { merchant:vHotel,                               mcat:'Hotels & Resorts' });
    add('DEBIT','CARD_PAYMENT', vary(y, m, 96, 440,   980),   `Vacation Activities & Dining – ${vDest}`, dt(y, m, 16, 19, 0), { merchant:`RESORT ACTIVITIES – ${vDest.toUpperCase()}`, mcat:'Travel' });
  }

  // ── ONE-OFF LARGE PURCHASES ──
  const oneOff = {
    '2020-3':  { desc:'TAG Heuer Aquaracer 43mm Watch',                    mer:'TAG HEUER BOUTIQUE NYC',           amt:2_250  },
    '2021-4':  { desc:'Sony Bravia 85" 8K Master Series TV',               mer:'BEST BUY 45TH ST NYC',             amt:1_850  },
    '2021-9':  { desc:'Living Room Furniture – West Elm',                  mer:'WEST ELM CHELSEA NYC',             amt:3_200  },
    '2022-3':  { desc:'Apple MacBook Pro 14" M2 – Personal',               mer:'APPLE STORE FIFTH AVE',            amt:2_499  },
    '2022-8':  { desc:'IWC Pilot Chronograph Mark XVIII Watch',            mer:'IWC BOUTIQUE NEW YORK',            amt:8_400  },
    '2023-2':  { desc:'Peloton Tread+ & Accessories',                      mer:'PELOTON INTERACTIVE INC',          amt:3_495  },
    '2023-5':  { desc:'Bose Home Cinema + Soundbar System',                mer:'BOSE STORE MADISON AVE',           amt:3_100  },
    '2023-11': { desc:'Rolex Submariner Date – 41mm Oystersteel',          mer:'ROLEX AUTHORISED DEALER NYC',      amt:13_500 },
    '2024-1':  { desc:'Breitling Navitimer B01 Chronograph – Pilot Watch', mer:'BREITLING BOUTIQUE SOHO',          amt:7_200  },
    '2024-6':  { desc:'Master Bathroom Renovation – Apartment',            mer:'HARBOR CONTRACTORS LLC NYC',       amt:11_800 },
    '2025-3':  { desc:'Tesla Model S Plaid – Vehicle Purchase',            mer:'TESLA INC – VEHICLE PURCHASE',     amt:98_500 },
    '2025-4':  { desc:'Tesla Model S – NY DMV Registration & Tax',         mer:'NY DMV VEHICLE REGISTRATION',      amt:2_150  },
    '2025-8':  { desc:'Audemars Piguet Royal Oak 15500 – Limited Edition', mer:'AUDEMARS PIGUET BOUTIQUE NYC',     amt:32_000 },
    '2025-12': { desc:'Custom Dining Table & Chairs – RH Restoration',     mer:'RESTORATION HARDWARE MEATPACKING', amt:9_800  },
    '2026-2':  { desc:'Kitchen Renovation – Sub-Zero & Miele Appliances',  mer:'SUB-ZERO & WOLF SHOWROOM NYC',     amt:22_500 },
    '2026-5':  { desc:'Bespoke Travel Wardrobe – Brioni Madison Ave',      mer:'BRIONI NEW YORK',                  amt:6_400  },
  };
  const item = oneOff[`${y}-${m}`];
  if (item) add('DEBIT','CARD_PAYMENT', item.amt, item.desc, dt(y, m, safe(y, m, 15), 13, 0), { merchant:item.mer, mcat:'Luxury Goods' });

  // ── PARIS LUXURY VACATION SAVINGS GOAL (Feb 2022 – May 2025, £2,500/mo = £100k) ──
  const inGoal = (y === 2022 && m >= 2) || y === 2023 || y === 2024 || (y === 2025 && m <= 5);
  if (inGoal) {
    add('DEBIT','GOAL_CONTRIBUTION', 2_500, 'Savings Goal – Paris Luxury Vacation 🗼', dt(y, m, safe(y, m, 27), 10, 0), { merchant:'LUMINA SAVINGS GOAL', mcat:'Savings' });
  }

  // ── OCCASIONAL SCHWAB TOP-UP ──
  if ((y * 12 + m) % 7 === 0) {
    add('DEBIT','INVESTMENT', vary(y, m, 99, 2_000, 5_500), 'Transfer to Investment Account – Charles Schwab', dt(y, m, safe(y, m, 26), 11, 0), { cpty:'Charles Schwab Corp', cptyBank:'Schwab Bank' });
  }
}

// ── generate all months ────────────────────────────────────────────────────

for (let y = 2020; y <= 2026; y++) {
  const last = y === 2026 ? 7 : 12;
  for (let m = 1; m <= last; m++) genMonth(y, m);
}

// ── SORT by valueDate (chronological) then compute balance chain ───────────

raw.sort((a, b) => a.valueDate - b.valueDate);

let runBal = 0;
const txns = raw.map(t => {
  const bb = Math.round(runBal * 100) / 100;
  runBal = Math.round((t.type === 'CREDIT' ? runBal + t.amount : runBal - t.amount) * 100) / 100;
  return { ...t, reference: ref(t.type === 'CREDIT' ? 'CR' : 'DR'), balanceBefore: bb, balanceAfter: runBal };
});

// ── final balance adjustment (expected to be very small) ──────────────────

const diff = Math.round((TARGET_BALANCE - runBal) * 100) / 100;
if (Math.abs(diff) >= 0.01) {
  const adjDate = dt(2026, 7, 31, 17, 0);
  const bb = Math.round(runBal * 100) / 100;
  runBal = Math.round((diff > 0 ? runBal + diff : runBal - Math.abs(diff)) * 100) / 100;
  txns.push({
    id: uid(), reference: ref(diff > 0 ? 'CR' : 'DR'),
    accountId: ACCOUNT_ID, currency: 'GBP', status: 'COMPLETED',
    type: diff > 0 ? 'CREDIT' : 'DEBIT',
    category: diff > 0 ? 'INVESTMENT' : 'FEE',
    amount: Math.abs(diff),
    description: diff > 0 ? 'Quantal – Q2 2026 Distribution Adjustment' : 'Quantal – Annual Management Fee',
    merchantName: 'QUANTAL INVESTMENT LTD',
    merchantCategory: 'Investment',
    counterpartyName: null, counterpartyAccountNumber: null, counterpartyBank: null,
    metadata: null,
    balanceBefore: bb, balanceAfter: runBal,
    valueDate: adjDate, createdAt: adjDate,
  });
}

console.log(`Generated ${txns.length} transactions.`);
console.log(`Final running balance: £${runBal.toLocaleString('en-GB', { minimumFractionDigits:2 })}`);
if (Math.abs(diff) < 0.01) console.log('  → No adjustment needed. Perfect balance.');
else console.log(`  → Adjustment applied: £${Math.abs(diff).toFixed(2)}`);

// ── database write ─────────────────────────────────────────────────────────

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM "Transaction" WHERE "accountId" = $1', [ACCOUNT_ID]);
    console.log('Cleared existing transactions.');

    await client.query(`UPDATE "Account" SET currency='GBP', "updatedAt"=NOW() WHERE id=$1`, [ACCOUNT_ID]);

    const BATCH = 80;
    for (let i = 0; i < txns.length; i += BATCH) {
      const chunk = txns.slice(i, i + BATCH);
      const vals = [], prms = [];
      let p = 1;
      for (const t of chunk) {
        vals.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
        prms.push(t.id, t.reference, ACCOUNT_ID, t.type, t.category, t.amount, t.currency,
          t.balanceBefore, t.balanceAfter, t.description,
          t.merchantName, t.merchantCategory,
          t.counterpartyName, t.counterpartyAccountNumber, t.counterpartyBank,
          t.status, t.metadata, t.valueDate, t.createdAt);
      }
      await client.query(
        `INSERT INTO "Transaction" (id,reference,"accountId",type,category,amount,currency,"balanceBefore","balanceAfter",description,"merchantName","merchantCategory","counterpartyName","counterpartyAccountNumber","counterpartyBank",status,metadata,"valueDate","createdAt") VALUES ${vals.join(',')}`,
        prms
      );
      process.stdout.write(`\r  Inserted ${Math.min(i + BATCH, txns.length)} / ${txns.length}`);
    }
    console.log('\nAll transactions inserted.');

    await client.query(
      `UPDATE "Account" SET balance=$1, "availableBalance"=$1, "updatedAt"=NOW() WHERE id=$2`,
      [TARGET_BALANCE, ACCOUNT_ID]
    );
    console.log(`Account balance set to £${TARGET_BALANCE.toLocaleString()}.`);

    // Paris Luxury Vacation savings goal – 40 months × £2,500 = £100,000
    await client.query('DELETE FROM "SavingsGoal" WHERE "userId"=$1', [USER_ID]);
    const goalContrib = 2_500 * 40; // £100,000
    await client.query(
      `INSERT INTO "SavingsGoal" (id,"userId","accountId",name,"targetAmount","currentAmount","targetDate",emoji,status,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [uid(), USER_ID, ACCOUNT_ID, 'Paris Luxury Vacation 🗼', 100_000, goalContrib,
       new Date('2025-07-01T00:00:00Z'), '🗼', 'ACHIEVED',
       new Date('2022-02-01T00:00:00Z'), new Date('2025-05-27T10:00:00Z')]
    );
    console.log(`Paris vacation goal created – ACHIEVED (£${goalContrib.toLocaleString()} / £100,000).`);

    await client.query('COMMIT');
    console.log('✓ Seeding complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error – rolled back:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
