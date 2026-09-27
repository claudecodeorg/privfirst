import { describe, expect, it } from 'vitest';
import { format, minify, parseJson, sortKeysDeep } from './logic';

describe('format / minify', () => {
  it('pretty-prints with the given indent', () => expect(format('{"a":1,"b":[1,2]}', 2)).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}'));
  it('minifies', () => expect(minify('{\n  "a": 1\n}')).toBe('{"a":1}'));
  it('round-trips through both', () => {
    const src = '{"z":1,"a":[true,null,"x"]}';
    expect(minify(format(src, 2))).toBe(src);
  });
  it('throws a readable error for invalid JSON', () => {
    expect(() => format('{invalid', 2)).toThrow();
    expect(() => minify('not json')).toThrow();
  });
});

describe('parseJson', () => {
  it('returns the parsed value on success', () => {
    const r = parseJson('[1,2,3]');
    expect('value' in r && r.value).toEqual([1, 2, 3]);
  });
  it('returns an error object on failure, without throwing', () => {
    const r = parseJson('{"a":}');
    expect('error' in r).toBe(true);
  });
});

describe('sortKeysDeep', () => {
  it('sorts object keys recursively, leaves arrays and primitives alone', () => {
    expect(sortKeysDeep({ b: 1, a: { d: 1, c: 2 } })).toEqual({ a: { c: 2, d: 1 }, b: 1 });
    expect(sortKeysDeep([{ b: 1, a: 2 }])).toEqual([{ a: 2, b: 1 }]);
    expect(sortKeysDeep(5)).toBe(5);
    expect(sortKeysDeep(null)).toBeNull();
  });
});
