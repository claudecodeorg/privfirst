// Pure, dependency-free paywall logic for the Android (Play Store) native app only — no Capacitor
// import here on purpose, so this stays trivially unit-testable in Node. The free web app is never
// gated; see billing.native.ts (isGated) for how "native app" is actually detected, and
// docs/android-publishing.md for how this all fits together end to end.

export const LIFETIME_SKU = 'lifetime_access';
export const TRIAL_MS = 24 * 60 * 60 * 1000;
const TRIAL_START_KEY = 'privfirst.trialStart';
const ENTITLED_CACHE_KEY = 'privfirst.entitledCache';

export type AccessState = 'free' | 'trial' | 'expired' | 'purchased';

export function getAccessState(opts: { gated: boolean; entitled: boolean; now: number; trialStart: number }): AccessState {
  if (!opts.gated) return 'free'; // the web app is always free; only the native Android app is ever gated
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

/** There is no backend, so once Play confirms a purchase this is the only record of it. Checked
 *  again on every launch (see checkEntitlement in billing.native.ts); only trusted directly when
 *  that live check can't run at all, e.g. offline. */
export function getCachedEntitlement(): boolean {
  return getStore()?.getItem(ENTITLED_CACHE_KEY) === '1';
}

export function setCachedEntitlement(entitled: boolean): void {
  const store = getStore();
  if (!store) return;
  if (entitled) store.setItem(ENTITLED_CACHE_KEY, '1');
  else store.removeItem(ENTITLED_CACHE_KEY); // e.g. Play reports a refund on next live check
}
