import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAccessState, getOrInitTrialStart, isTWA, msRemaining, TRIAL_MS } from './billing';

describe('isTWA', () => {
  it('is true only for an android-app:// referrer', () => {
    expect(isTWA('android-app://dev.privfirst.twa')).toBe(true);
    expect(isTWA('https://claudecodeorg.github.io/privfirst/')).toBe(false);
    expect(isTWA('')).toBe(false);
  });
});

describe('getAccessState', () => {
  const base = { now: 1_000_000, trialStart: 900_000 };
  it('is always free outside the packaged app, regardless of trial or entitlement', () => {
    expect(getAccessState({ ...base, inTwa: false, entitled: false })).toBe('free');
    expect(getAccessState({ ...base, inTwa: false, entitled: true, trialStart: 0 })).toBe('free');
  });
  it('is purchased once entitled, even if the trial would otherwise have expired', () => {
    expect(getAccessState({ inTwa: true, entitled: true, now: 1_000_000, trialStart: 0 })).toBe('purchased');
  });
  it('is in trial within 24 hours of the recorded start', () => {
    expect(getAccessState({ inTwa: true, entitled: false, now: 0, trialStart: 0 })).toBe('trial');
    expect(getAccessState({ inTwa: true, entitled: false, now: TRIAL_MS - 1, trialStart: 0 })).toBe('trial');
  });
  it('expires at exactly 24 hours and stays expired after', () => {
    expect(getAccessState({ inTwa: true, entitled: false, now: TRIAL_MS, trialStart: 0 })).toBe('expired');
    expect(getAccessState({ inTwa: true, entitled: false, now: TRIAL_MS * 10, trialStart: 0 })).toBe('expired');
  });
});

describe('msRemaining', () => {
  it('counts down within the trial window', () => expect(msRemaining(1000, 0)).toBe(TRIAL_MS - 1000));
  it('never goes negative once expired', () => expect(msRemaining(TRIAL_MS * 5, 0)).toBe(0));
});

describe('getOrInitTrialStart', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
      key: () => null,
      get length() { return store.size; },
    };
  });
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });

  it('records the first call\'s timestamp and keeps returning it on later calls', () => {
    expect(getOrInitTrialStart(500)).toBe(500);
    expect(getOrInitTrialStart(999_999)).toBe(500); // a much later "now" doesn't move the recorded start
  });
  it('falls back to "now" when no storage is available (never persists a false trial start)', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(getOrInitTrialStart(123)).toBe(123);
    expect(getOrInitTrialStart(456)).toBe(456);
  });
});
