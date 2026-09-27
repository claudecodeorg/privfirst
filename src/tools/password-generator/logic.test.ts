import { describe, expect, it } from 'vitest';
import { generatePassphrase, generatePassword, passphraseEntropy, passwordEntropy, randomInt, strengthLabel, type PasswordOptions } from './logic';
import { WORDS } from './wordlist';

const base: PasswordOptions = { length: 20, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: false };

describe('randomInt', () => {
  it('stays in range', () => {
    for (let i = 0; i < 500; i++) expect(randomInt(7)).toBeLessThan(7);
  });
  it('rejects values in the biased tail', () => {
    // max=3 -> limit = 4294967295 - so 0xFFFFFFFF must be rejected, then 5 accepted.
    const seq = [0xffffffff, 5];
    let i = 0;
    expect(randomInt(3, (a) => { a[0] = seq[i++]; return a; })).toBe(2);
    expect(i).toBe(2);
  });
  it('validates max', () => expect(() => randomInt(0)).toThrow());
});

describe('generatePassword', () => {
  it('has the requested length and includes every selected class', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword({ ...base, length: 8 });
      expect(p).toHaveLength(8);
      expect(p).toMatch(/[a-z]/); expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/\d/); expect(p).toMatch(/[^A-Za-z0-9]/);
    }
  });
  it('excludes ambiguous characters when asked', () => {
    for (let i = 0; i < 50; i++) expect(generatePassword({ ...base, symbols: false, avoidAmbiguous: true, length: 64 })).not.toMatch(/[O0oIl1|]/);
  });
  it('errors on no sets or too-short length', () => {
    expect(() => generatePassword({ ...base, lower: false, upper: false, digits: false, symbols: false })).toThrow();
    expect(() => generatePassword({ ...base, length: 3 })).toThrow();
  });
});

describe('passphrase & entropy', () => {
  it('uses list words with the separator', () => {
    const p = generatePassphrase({ words: 5, separator: '-', capitalize: false, addNumber: false });
    const parts = p.split('-');
    expect(parts).toHaveLength(5);
    parts.forEach((w) => expect(WORDS).toContain(w));
  });
  it('has 1296 words', () => expect(WORDS).toHaveLength(1296));
  it('computes entropy', () => {
    expect(passphraseEntropy({ words: 6, separator: '-', capitalize: false, addNumber: false })).toBeCloseTo(62.0, 0);
    expect(passwordEntropy({ ...base, length: 10, symbols: false, upper: false, digits: false })).toBeCloseTo(10 * Math.log2(26), 5);
    expect(strengthLabel(40)).toBe('Weak');
    expect(strengthLabel(130)).toBe('Excellent');
  });
});
