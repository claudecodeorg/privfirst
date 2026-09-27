// Paywall for the Android (Play Store) packaging only. The free web app is never gated: every check
// here resolves to "unlocked" unless actually running inside the Trusted Web Activity that Google Play
// Billing requires. See docs/android-publishing.md for how this fits together end to end.

export const LIFETIME_SKU = 'lifetime_access';
export const TRIAL_MS = 24 * 60 * 60 * 1000;
const TRIAL_START_KEY = 'privfirst.trialStart';
const PLAY_BILLING_METHOD = 'https://play.google.com/billing';

/** True only inside the packaged Android app, never in a normal browser tab — this is the standard,
 *  Google-documented way a TWA-hosted page tells itself apart from the same site opened in Chrome. */
export function isTWA(referrer: string = typeof document !== 'undefined' ? document.referrer : ''): boolean {
  return referrer.startsWith('android-app://');
}

export type AccessState = 'free' | 'trial' | 'expired' | 'purchased';

export function getAccessState(opts: { inTwa: boolean; entitled: boolean; now: number; trialStart: number }): AccessState {
  if (!opts.inTwa) return 'free'; // the web app is always free; only the packaged app is ever gated
  if (opts.entitled) return 'purchased';
  return opts.now - opts.trialStart < TRIAL_MS ? 'trial' : 'expired';
}

export function msRemaining(now: number, trialStart: number): number {
  return Math.max(0, TRIAL_MS - (now - trialStart));
}

function getStore(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/** Records, once, when this install was first opened, so the trial window has a fixed start point. */
export function getOrInitTrialStart(now: number = Date.now()): number {
  const store = getStore();
  if (!store) return now; // no persistence available: treat every load as a fresh trial start
  const existing = Number(store.getItem(TRIAL_START_KEY));
  if (existing > 0) return existing;
  store.setItem(TRIAL_START_KEY, String(now));
  return now;
}

interface DigitalGoodsService { listPurchases(): Promise<{ itemId: string }[]> }
declare global { interface Window { getDigitalGoodsService?(paymentMethod: string): Promise<DigitalGoodsService> } }

/** Asks Google Play (via the Digital Goods API) whether this Google account already owns the lifetime SKU. */
export async function checkEntitlement(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.getDigitalGoodsService) return false;
  try {
    const service = await window.getDigitalGoodsService(PLAY_BILLING_METHOD);
    const purchases = await service.listPurchases();
    return purchases.some((p) => p.itemId === LIFETIME_SKU);
  } catch { return false; }
}

/** Launches the Play Billing purchase sheet for the lifetime SKU. Resolves true only on a completed purchase. */
export async function purchaseLifetime(): Promise<boolean> {
  if (typeof PaymentRequest === 'undefined') return false;
  const request = new PaymentRequest(
    [{ supportedMethods: PLAY_BILLING_METHOD, data: { sku: LIFETIME_SKU } }],
    { total: { label: 'PrivFirst lifetime access', amount: { currency: 'USD', value: '1.00' } } },
  );
  try {
    const response = await request.show();
    await response.complete('success');
    return true;
  } catch {
    return false;
  }
}
