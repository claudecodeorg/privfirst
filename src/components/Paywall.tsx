import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { checkEntitlement, getAccessState, getOrInitTrialStart, isTWA, msRemaining, purchaseLifetime, type AccessState } from '../lib/billing';

const HOUR = 60 * 60 * 1000;

export function Paywall({ children }: { children: ComponentChildren }) {
  const inTwa = isTWA();
  // Optimistic default: the app renders normally immediately, then the real check (async, since it
  // calls Play Billing) resolves a moment later and can still show the expired screen if needed.
  const [state, setState] = useState<AccessState>(() => (inTwa ? 'trial' : 'free'));
  const [remaining, setRemaining] = useState(0);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  const refresh = async () => {
    if (!inTwa) return;
    const trialStart = getOrInitTrialStart();
    const entitled = await checkEntitlement();
    const now = Date.now();
    setState(getAccessState({ inTwa, entitled, now, trialStart }));
    setRemaining(msRemaining(now, trialStart));
  };

  useEffect(() => { void refresh(); }, []);
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
      const ok = await purchaseLifetime();
      if (ok) await refresh();
      else setPurchaseError('Purchase was not completed.');
    } catch (e) {
      setPurchaseError(e instanceof Error ? e.message : 'Purchase failed.');
    } finally { setPurchasing(false); }
  };

  if (state === 'expired') {
    return (
      <main class="container">
        <header class="hero"><h1>PrivFirst</h1></header>
        <div class="card">
          <h2>Your free day has ended</h2>
          <p class="muted">Unlock PrivFirst for a one-time $1 payment — no subscription, use it for as long as you have this app.</p>
          <button class="primary" disabled={purchasing} onClick={buy}>{purchasing ? 'Working…' : 'Buy lifetime access — $1'}</button>
          <p style="margin-top:8px"><button onClick={() => void refresh()} disabled={purchasing}>Restore purchase</button></p>
          {purchaseError && <p class="error" role="alert">{purchaseError}</p>}
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
