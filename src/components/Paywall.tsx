import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { getAccessState, getOrInitTrialStart, msRemaining, type AccessState } from '../lib/billing';
import { checkEntitlement, fetchDisplayPrice, isGated, isGatedAsync, purchaseLifetime } from '../lib/billing.native';

const HOUR = 60 * 60 * 1000;

export function Paywall({ children }: { children: ComponentChildren }) {
  // Optimistic default for the real native app (a synchronous, side-effect-free check): the app
  // renders normally immediately, then the real check below (async, since it may call Play
  // Billing) resolves a moment later and can still show the expired screen if needed. The dev-only
  // mock path (?mockBilling=...) is async-only and so only takes effect once that check resolves.
  const [state, setState] = useState<AccessState>(() => (isGated() ? 'trial' : 'free'));
  const [remaining, setRemaining] = useState(0);
  const [price, setPrice] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  const refresh = async () => {
    const gated = await isGatedAsync();
    if (!gated) { setState('free'); return; }
    const trialStart = getOrInitTrialStart();
    const entitled = await checkEntitlement();
    const now = Date.now();
    setState(getAccessState({ gated, entitled, now, trialStart }));
    setRemaining(msRemaining(now, trialStart));
  };

  useEffect(() => {
    void refresh();
    void fetchDisplayPrice().then(setPrice);
  }, []);
  // While in the trial, recheck periodically so the countdown (and an expiry) reflect real time passing
  // without needing the app to be closed and reopened.
  useEffect(() => {
    if (state !== 'trial') return;
    const id = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(id);
  }, [state]);

  const buy = async () => {
    setPurchasing(true); setPurchaseError('');
    try {
      const result = await purchaseLifetime();
      if (result.ok) await refresh();
      else if (result.message) setPurchaseError(result.message);
    } catch (e) {
      setPurchaseError(e instanceof Error ? e.message : 'Purchase failed.');
    } finally { setPurchasing(false); }
  };

  if (state === 'expired') {
    const priceLabel = price ?? '$1';
    return (
      <main class="container">
        <header class="hero"><h1>PrivFirst</h1></header>
        <div class="card">
          <h2>Your free day has ended</h2>
          <p class="muted">Unlock PrivFirst for a one-time payment of {priceLabel} — no subscription, no account, use it for as long as you have this app.</p>
          <button class="primary" disabled={purchasing} onClick={buy}>{purchasing ? 'Working…' : `Buy lifetime access — ${priceLabel}`}</button>
          <p style="margin-top:8px"><button onClick={() => void refresh()} disabled={purchasing}>Restore purchase</button></p>
          {purchaseError && <p class="error" role="alert">{purchaseError}</p>}
          <p class="muted" style="margin-top:12px;font-size:.85rem">Handled entirely by Google Play — PrivFirst never sees your payment details, and there's no account or server involved.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      {state === 'trial' && remaining < 6 * HOUR && (
        <p class="muted" style="text-align:center;padding:8px;margin:0;background:var(--panel);border-bottom:1px solid var(--border)">
          Free trial: {Math.max(1, Math.ceil(remaining / HOUR))}h left
        </p>
      )}
      {children}
    </>
  );
}
