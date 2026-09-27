import { findMatches } from './logic';

export interface RegexJob { pattern: string; flags: string; text: string }
export type RegexResult = { ok: true; matches: ReturnType<typeof findMatches> } | { ok: false; error: string };

self.onmessage = (e: MessageEvent<RegexJob>) => {
  const { pattern, flags, text } = e.data;
  try {
    (self as unknown as Worker).postMessage({ ok: true, matches: findMatches(pattern, flags, text) } satisfies RegexResult);
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) } satisfies RegexResult);
  }
};
