import { describe, expect, it } from 'vitest';
import { findPii, redact } from './logic';

describe('findPii', () => {
  it('finds an email address', () => {
    const f = findPii('Contact jane.doe+work@example.co.uk please');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ type: 'email', text: 'jane.doe+work@example.co.uk' });
  });
  it('finds a US SSN pattern', () => expect(findPii('SSN: 123-45-6789').some((f) => f.type === 'ssn')).toBe(true));
  it('finds an IPv4 address but not an out-of-range lookalike', () => {
    expect(findPii('server at 192.168.1.10 responded').some((f) => f.type === 'ip' && f.text === '192.168.1.10')).toBe(true);
    expect(findPii('version 999.999.999.999').some((f) => f.type === 'ip')).toBe(false);
  });
  it('accepts a Luhn-valid card number and rejects an invalid one', () => {
    expect(findPii('card 4111 1111 1111 1111 on file').some((f) => f.type === 'credit-card')).toBe(true);
    expect(findPii('card 4111 1111 1111 1112 on file').some((f) => f.type === 'credit-card')).toBe(false);
  });
  it('finds a phone number', () => expect(findPii('call (415) 555-2671 now').some((f) => f.type === 'phone')).toBe(true));
  it('does not double-report a shorter match nested inside a longer one', () => {
    const f = findPii('4111 1111 1111 1111');
    expect(f.filter((x) => x.start === 0)).toHaveLength(1);
  });
  it('returns nothing for ordinary text', () => expect(findPii('The quick brown fox jumps over the lazy dog.')).toEqual([]));
  it('reports accurate start/end offsets', () => {
    const text = 'x@y.com';
    const [f] = findPii(text);
    expect(text.slice(f.start, f.end)).toBe('x@y.com');
  });
});

describe('redact', () => {
  it('masks matches with same-length bullets by default', () => {
    const text = 'email me at a@b.com ok?';
    const out = redact(text, findPii(text), 'mask');
    expect(out).toBe('email me at ••••••• ok?'); // "a@b.com" is 7 characters
  });
  it('replaces matches with a labeled placeholder', () => {
    const text = 'email me at a@b.com ok?';
    const out = redact(text, findPii(text), 'placeholder');
    expect(out).toBe('email me at [EMAIL] ok?');
  });
  it('handles multiple findings in one string', () => {
    const text = 'a@b.com and c@d.com';
    const out = redact(text, findPii(text), 'placeholder');
    expect(out).toBe('[EMAIL] and [EMAIL]');
  });
});
