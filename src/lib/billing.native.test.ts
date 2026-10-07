import { describe, expect, it } from 'vitest';
import { checkEntitlement, fetchDisplayPrice, isGated, purchaseLifetime } from './billing.native';

// These run under vitest's Node environment (no window, no Capacitor native bridge, no `location`,
// so no ?mockBilling= URL to read either) — i.e. exactly how the free web app actually behaves.
describe('billing.native outside the native app', () => {
  it('is never gated', () => {
    expect(isGated()).toBe(false);
  });
  it('is never entitled', async () => {
    expect(await checkEntitlement()).toBe(false);
  });
  it('has no price to show', async () => {
    expect(await fetchDisplayPrice()).toBeNull();
  });
  it('refuses to start a purchase', async () => {
    expect(await purchaseLifetime()).toEqual({ ok: false, message: 'Not available outside the Android app.' });
  });
});
