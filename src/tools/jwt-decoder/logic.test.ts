import { describe, expect, it } from 'vitest';
import { decodeJwt, verifyHs256 } from './logic';

// header {alg:HS256,typ:JWT}, payload {sub,name,iat}, signed with secret "secret" (verified independently via Node's crypto).
const KNOWN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o';

describe('decodeJwt', () => {
  it('decodes header and payload', () => {
    const d = decodeJwt(KNOWN);
    expect(d.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(d.payload).toMatchObject({ sub: '1234567890', name: 'John Doe' });
    expect(d.iat).toEqual(new Date(1516239022 * 1000));
  });
  it('flags expiry relative to now', () => {
    const past = btoa(JSON.stringify({ exp: 1000 })).replace(/=+$/, '');
    const future = btoa(JSON.stringify({ exp: 4102444800 })).replace(/=+$/, ''); // year 2100
    const h = btoa(JSON.stringify({ alg: 'none' })).replace(/=+$/, '');
    expect(decodeJwt(`${h}.${past}.x`).exp?.expired).toBe(true);
    expect(decodeJwt(`${h}.${future}.x`).exp?.expired).toBe(false);
  });
  it('rejects malformed tokens', () => {
    expect(() => decodeJwt('not.a.jwt.token')).toThrow(/three/);
    expect(() => decodeJwt('abc.def')).toThrow(/three/);
    expect(() => decodeJwt('***.***.***')).toThrow(/Base64URL/);
  });
});

describe('verifyHs256', () => {
  it('accepts the correct secret and rejects a wrong one', async () => {
    const d = decodeJwt(KNOWN);
    expect(await verifyHs256(d, 'secret')).toBe(true);
    expect(await verifyHs256(d, 'wrong')).toBe(false);
  });
  it('rejects a tampered payload', async () => {
    const [h, , s] = KNOWN.split('.');
    const tamperedPayload = btoa(JSON.stringify({ sub: 'different', name: 'Eve' })).replace(/=+$/, '');
    const tampered = decodeJwt(`${h}.${tamperedPayload}.${s}`);
    expect(await verifyHs256(tampered, 'secret')).toBe(false);
  });
});
