import { randomBytes, randomInt } from 'crypto';

function randomDigits(count: number): string {
  return Array.from({ length: count }, () => randomInt(0, 10)).join('');
}

export function generateAccountNumber(): string {
  // UK standard: 8 digits, first digit non-zero
  return `${randomInt(1, 10)}${randomDigits(7)}`;
}

export function generateSortCode(): string {
  // UK sort code: 6 digits formatted as XX-XX-XX
  const digits = randomDigits(6);
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

export function generateIBAN(currency: string = 'GBP'): string {
  if (currency === 'GBP') {
    // UK IBAN: GB + 2 check digits + 4-char bank code + 6-digit sort code + 8-digit account number = 22 chars
    const bankCode = 'LUMI';
    const sortCode = randomDigits(6);
    const accountNumber = generateAccountNumber();
    const bban = `${bankCode}${sortCode}${accountNumber}`;
    const checkDigits = computeIBANCheckDigits(bban, 'GB');
    return `GB${checkDigits}${bban}`;
  }

  // Other currencies — keep simple format
  const countryCode = currencyToCountryCode(currency);
  const bankCode = '0824';
  const checkDigits = String(randomInt(10, 100));
  const accountPart = randomDigits(16);
  return `${countryCode}${checkDigits}${bankCode}${accountPart}`;
}

function computeIBANCheckDigits(bban: string, countryCode: string = 'GB'): string {
  // Move BBAN + country code + '00' then convert letters to numbers, MOD 97
  const rearranged = `${bban}${countryCode}00`;
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + parseInt(ch, 10)) % 97;
  }
  return String(98 - remainder).padStart(2, '0');
}

function currencyToCountryCode(currency: string): string {
  const map: Record<string, string> = {
    USD: 'US',
    EUR: 'DE',
    GBP: 'GB',
    NGN: 'NG',
    JPY: 'JP',
    CAD: 'CA',
    AUD: 'AU',
    CHF: 'CH',
  };
  return map[currency] ?? 'GB';
}

export function maskAccountNumber(accountNumber: string): string {
  return `****${accountNumber.slice(-4)}`;
}

export function generateVirtualCardPan(): string {
  // Luhn-valid 16-digit number starting with 4 (Visa-like)
  const partial = `4${randomDigits(14)}`;
  const check = luhnCheckDigit(partial);
  return `${partial}${check}`;
}

function luhnCheckDigit(number: string): number {
  let sum = 0;
  let alternate = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let n = parseInt(number[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return (10 - (sum % 10)) % 10;
}

export function maskPan(pan: string): string {
  return `**** **** **** ${pan.slice(-4)}`;
}

export function generateRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
