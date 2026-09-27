import { describe, expect, it } from 'vitest';
import { csvToJson, jsonToCsv, parseCsv, stringifyCsv } from './logic';

describe('parseCsv', () => {
  it('parses plain rows', () => expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]));
  it('handles quoted fields with commas, newlines and escaped quotes', () => {
    expect(parseCsv('name,note\n"Doe, Jane","she said ""hi""\nand left"')).toEqual([
      ['name', 'note'],
      ['Doe, Jane', 'she said "hi"\nand left'],
    ]);
  });
  it('handles CRLF and LF line endings', () => expect(parseCsv('a,b\r\n1,2\n3,4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]));
  it('drops a single trailing blank line', () => expect(parseCsv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]));
  it('supports an alternate delimiter', () => expect(parseCsv('a;b\n1;2', ';')).toEqual([['a', 'b'], ['1', '2']]));
});

describe('stringifyCsv', () => {
  it('quotes only fields that need it', () => {
    expect(stringifyCsv([['plain', 'has,comma', 'has"quote', 'has\nnewline']]))
      .toBe('plain,"has,comma","has""quote","has\nnewline"');
  });
  it('round-trips through parseCsv', () => {
    const rows = [['a', 'b'], ['1, one', 'line\nbreak'], ['"quoted"', '']];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
});

describe('csvToJson / jsonToCsv', () => {
  it('converts CSV to an array of objects keyed by header', () => {
    expect(csvToJson('name,age\nAlice,30\nBob,25')).toEqual([{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]);
  });
  it('fills missing trailing fields with empty strings', () => expect(csvToJson('a,b,c\n1')).toEqual([{ a: '1', b: '', c: '' }]));
  it('converts an array of objects back to CSV, unioning keys', () => {
    const csv = jsonToCsv([{ a: 1, b: 2 }, { a: 3, c: 4 }]);
    expect(csvToJson(csv)).toEqual([{ a: '1', b: '2', c: '' }, { a: '3', b: '', c: '4' }]);
  });
  it('returns an empty string for no rows', () => expect(jsonToCsv([])).toBe(''));
});
