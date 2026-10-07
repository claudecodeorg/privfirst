// Dev-only harness for exercising every Paywall UI state without a real device or Play Store
// account. Picked up via a `?mockBilling=trial|expired|purchased|unavailable` URL param — see
// billing.native.ts. The only call sites are behind `if (import.meta.env.DEV)`, which Vite
// dead-code-eliminates entirely in a production build; scripts/check-no-mock-in-release.mjs
// verifies that by grepping the built dist for PRIVFIRST_MOCK_BILLING_MARKER below.
import type { ProductDetailsResult, PurchaseResult, QueryPurchasesResult } from './nativePlugins';

export const PRIVFIRST_MOCK_BILLING_MARKER = 'PRIVFIRST_MOCK_BILLING_MARKER';

export type MockBillingState = 'trial' | 'expired' | 'purchased' | 'unavailable';

export function readMockState(): MockBillingState | null {
  if (typeof location === 'undefined') return null; // e.g. running under vitest, no DOM/URL
  const v = new URLSearchParams(location.search).get('mockBilling');
  return v === 'trial' || v === 'expired' || v === 'purchased' || v === 'unavailable' ? v : null;
}

export function mockQueryPurchases(state: MockBillingState): QueryPurchasesResult {
  if (state === 'unavailable') return { owned: false, status: 'unavailable', message: PRIVFIRST_MOCK_BILLING_MARKER };
  return { owned: state === 'purchased' };
}

export function mockProductDetails(): ProductDetailsResult {
  return { found: true, formattedPrice: '$1.00', priceAmountMicros: '1000000', currencyCode: 'USD' };
}

export function mockPurchase(state: MockBillingState): PurchaseResult {
  if (state === 'unavailable') return { status: 'unavailable', message: PRIVFIRST_MOCK_BILLING_MARKER };
  return { status: 'purchased' };
}
