import { WORDS } from './wordlist';

/** Uniform random integer in [0, max) via rejection sampling (no modulo bias). */
export function randomInt(max: number, rng: (a: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer> = (a) => crypto.getRandomValues(a)): number {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new RangeError('max out of range');
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    const v = rng(buf)[0];
    if (v < limit) return v % max;
  }
}

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
};
const AMBIGUOUS = /[O0oIl1|]/g;

export function charsetsFor(o: PasswordOptions): string[] {
  return (['lower', 'upper', 'digits', 'symbols'] as const)
    .filter((k) => o[k])
    .map((k) => (o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]))
    .filter(Boolean);
}

export function generatePassword(o: PasswordOptions, rnd: (max: number) => number = randomInt): string {
  const sets = charsetsFor(o);
  if (!sets.length) throw new Error('Select at least one character type.');
  if (o.length < sets.length) throw new Error(`Length must be at least ${sets.length}.`);
  const all = sets.join('');
  // Guarantee one character from every selected set, fill the rest from the union, then shuffle.
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < o.length) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface PassphraseOptions { words: number; separator: string; capitalize: boolean; addNumber: boolean }

export function generatePassphrase(o: PassphraseOptions, rnd: (max: number) => number = randomInt): string {
  if (o.words < 1) throw new Error('Use at least one word.');
  const picked = Array.from({ length: o.words }, () => {
    const w = WORDS[rnd(WORDS.length)];
    return o.capitalize ? w[0].toUpperCase() + w.slice(1) : w;
  });
  if (o.addNumber) picked[rnd(picked.length)] += String(rnd(10));
  return picked.join(o.separator);
}

/** Entropy in bits of a password drawn uniformly from the selected sets (a slight over-estimate given the per-set guarantee). */
export function passwordEntropy(o: PasswordOptions): number {
  const size = charsetsFor(o).join('').length;
  return size ? o.length * Math.log2(size) : 0;
}

export function passphraseEntropy(o: PassphraseOptions): number {
  return o.words * Math.log2(WORDS.length) + (o.addNumber ? Math.log2(o.words * 10) : 0);
}

export function strengthLabel(bits: number): 'Weak' | 'Fair' | 'Strong' | 'Excellent' {
  return bits < 50 ? 'Weak' : bits < 75 ? 'Fair' : bits < 100 ? 'Strong' : 'Excellent';
}
