import { CardBrand } from '../generated/prisma/enums';

function digitBytes(len: number, rng: () => number) {
  let s = '';
  for (let i = 0; i < len; i++) s += String(Math.floor(rng() * 10));
  return s;
}

function isValidLuhn(num: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = +num[i]!;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Append check digit to 15-digit body */
export function withLuhnCheckDigit(fifteen: string): string {
  for (let c = 0; c <= 9; c++) {
    const candidate = fifteen + c;
    if (isValidLuhn(candidate)) return candidate;
  }
  return fifteen + '0';
}

export function generatePan(brand: CardBrand, rng: () => number = Math.random): string {
  const first = brand === CardBrand.VISA ? '4' : '5';
  const body = first + digitBytes(14, rng);
  return withLuhnCheckDigit(body);
}

export function maskFromPan(pan: string): string {
  const last4 = pan.slice(-4);
  return `••${last4}`;
}

export function generateCvv(rng: () => number = Math.random): string {
  return String(100 + Math.floor(rng() * 900));
}

export function generateAccountNumber(rng: () => number = Math.random): string {
  return digitBytes(12, rng);
}
