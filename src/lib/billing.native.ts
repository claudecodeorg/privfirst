// Capacitor/Play-Billing-dependent half of the paywall (see billing.ts for the pure state
// machine). Everything here is a no-op on the free web app — gated purely by
// Capacitor.isNativePlatform(), except in a dev build where a `?mockBilling=` URL param can
// simulate the native app for UI testing (see billing.mock.ts).
//
// billing.mock.ts is only ever reached through a dynamic `import()` behind
// `import.meta.env.DEV`, never a static import — Vite treats that as a real chunk boundary and
// drops the chunk entirely from a production build (verified empirically: a static import of
// billing.mock.ts behind the same DEV check was NOT removed by bundler dead-code elimination).
// scripts/check-no-mock-in-release.mjs double-checks this by grepping the built dist.
import { Capacitor } from '@capacitor/core';
import { LIFETIME_SKU, getCachedEntitlement, setCachedEntitlement } from './billing';
import type { MockBillingState } from './billing.mock';
import { PlayBilling } from './nativePlugins';

async function mockState(): Promise<MockBillingState | null> {
  if (!import.meta.env.DEV) return null;
  const { readMockState } = await import('./billing.mock');
  return readMockState();
}

/** True for the real native app, or (dev builds only) when a mock state is requested via URL —
 *  lets the Paywall UI be exercised from a normal browser during development. Synchronous: the
 *  real check (Capacitor.isNativePlatform()) always is, and the dev-only mock path resolves fast
 *  enough (a same-origin dynamic import) that callers just treat this as best-effort-sync via the
 *  isGatedAsync companion below when they need certainty before first paint. */
export function isGated(): boolean {
  return Capacitor.isNativePlatform();
}

/** Like isGated(), but also considers the dev-only mock state. Use where an async check is fine
 *  (everything except the very first synchronous render). */
export async function isGatedAsync(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return true;
  return (await mockState()) !== null;
}

/**
 * Asks Play whether the lifetime SKU is owned. If the query itself fails (offline, Play
 * unavailable, or the app was sideloaded with no Play Store present), trusts the last cached
 * result instead — entitlement must keep working fully offline after a purchase, since there is
 * no backend to fall back on. If Play succeeds and reports the SKU is NOT owned (e.g. a refund),
 * the cache is cleared.
 */
export async function checkEntitlement(): Promise<boolean> {
  const mock = await mockState();
  if (mock) {
    const { mockQueryPurchases } = await import('./billing.mock');
    return mockQueryPurchases(mock).owned;
  }
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await PlayBilling.queryPurchases();
    if (result.status === 'unavailable') return getCachedEntitlement();
    setCachedEntitlement(result.owned);
    return result.owned;
  } catch {
    return getCachedEntitlement();
  }
}

/** The real Play-formatted price (currency-aware), never hardcoded. Null if unavailable. */
export async function fetchDisplayPrice(): Promise<string | null> {
  const mock = await mockState();
  if (mock) {
    const { mockProductDetails } = await import('./billing.mock');
    return mockProductDetails().formattedPrice ?? null;
  }
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const result = await PlayBilling.queryProductDetails({ productId: LIFETIME_SKU });
    return result.found ? result.formattedPrice ?? null : null;
  } catch {
    return null;
  }
}

/** Launches the Play Billing purchase sheet for the lifetime SKU. `ok` is true only once Play
 *  reports the purchase actually succeeded (or was already owned). */
export async function purchaseLifetime(): Promise<{ ok: boolean; message?: string }> {
  const mock = await mockState();
  if (mock) {
    const { mockPurchase } = await import('./billing.mock');
    const result = mockPurchase(mock);
    if (result.status === 'purchased') setCachedEntitlement(true);
    return result.status === 'purchased' ? { ok: true } : { ok: false, message: result.message };
  }
  if (!Capacitor.isNativePlatform()) return { ok: false, message: 'Not available outside the Android app.' };
  try {
    const result = await PlayBilling.purchase({ productId: LIFETIME_SKU });
    if (result.status === 'purchased' || result.status === 'already_owned') {
      setCachedEntitlement(true);
      return { ok: true };
    }
    if (result.status === 'pending') {
      return { ok: false, message: 'Purchase is pending — it will unlock automatically once it completes.' };
    }
    if (result.status === 'canceled') return { ok: false };
    return { ok: false, message: result.message ?? 'Purchase failed.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Purchase failed.' };
  }
}
