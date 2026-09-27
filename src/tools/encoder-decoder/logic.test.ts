import { describe, expect, it } from 'vitest';
import { decode, encode, type Mode } from './logic';

const modes: Mode[] = ['base64', 'base64url', 'url', 'hex'];
const samples = ['hello world', 'Ünïcödé ✓ 日本語 🔒', '', 'a+b/c=d?e&f', '  spaces  '];

describe('round trip', () => {
  for (const mode of modes) for (const s of samples) {
    it(`${mode}: ${JSON.stringify(s)}`, () => expect(decode(mode, encode(mode, s))).toBe(s));
  }
});

describe('base64 specifics', () => {
  it('matches a known vector', () => expect(encode('base64', 'hello')).toBe('aGVsbG8='));
  it('base64url has no padding or +//', () => {
    const out = encode('base64url', 'sure.');
    expect(out).not.toMatch(/[+/=]/);
  });
  it('rejects invalid input', () => {
    expect(() => decode('base64', '***')).toThrow();
    expect(() => decode('hex', 'zz')).toThrow();
    expect(() => decode('hex', 'abc')).toThrow(); // odd length
  });
});

describe('hex specifics', () => {
  it('matches a known vector', () => expect(encode('hex', 'AB')).toBe('4142'));
  it('accepts an 0x prefix and whitespace on decode', () => expect(decode('hex', '0x 68 69')).toBe('hi'));
});

describe('url specifics', () => {
  it('escapes reserved characters', () => expect(encode('url', 'a b&c')).toBe('a%20b%26c'));
  it('rejects malformed percent-encoding', () => expect(() => decode('url', '%zz')).toThrow());
});
