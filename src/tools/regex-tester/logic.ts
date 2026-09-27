export interface Match { index: number; match: string; groups: string[]; named: Record<string, string> }

export function compileRegex(pattern: string, flags: string): RegExp {
  return new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
}

/** Runs entirely synchronously — the caller (a Worker, in the UI) is responsible for a timeout/terminate
 *  safeguard against catastrophic backtracking, which nothing inside plain JS regex execution can interrupt. */
export function findMatches(pattern: string, flags: string, text: string, maxMatches = 5000): Match[] {
  const re = compileRegex(pattern, flags);
  const out: Match[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < maxMatches) {
    out.push({ index: m.index, match: m[0], groups: m.slice(1).map((g) => g ?? ''), named: { ...m.groups } });
    if (m[0] === '') re.lastIndex++; // zero-width match: advance manually or exec() would loop forever
  }
  return out;
}
