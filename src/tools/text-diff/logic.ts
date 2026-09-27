import { diffArrays } from 'diff';

export type DiffMode = 'lines' | 'words' | 'chars';
export interface DiffOptions { mode: DiffMode; ignoreCase: boolean; ignoreWhitespace: boolean }
export interface Part { value: string; added?: boolean; removed?: boolean }
export interface DiffResult { parts: Part[]; added: number; removed: number; unchanged: number; identical: boolean }

const tokenizers: Record<DiffMode, (s: string) => string[]> = {
  lines: (s) => s.match(/[^\n]*\n|[^\n]+$/g) ?? [],
  words: (s) => s.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]+/gu) ?? [],
  chars: (s) => Array.from(s),
};

const unit = (mode: DiffMode, s: string) =>
  mode === 'lines' ? (s.match(/\n/g)?.length ?? 0) + (s && !s.endsWith('\n') ? 1 : 0) : mode === 'words' ? (s.match(/[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]+/gu)?.length ?? 0) : Array.from(s).length;

export function computeDiff(a: string, b: string, o: DiffOptions): DiffResult {
  // Tokens are compared in normalised form but emitted verbatim, so the output always shows the real text.
  const norm = (s: string) => {
    const t = o.ignoreWhitespace && o.mode === 'lines' ? s.trim().replace(/\s+/g, ' ') : s;
    return o.ignoreCase ? t.toLowerCase() : t;
  };
  const tok = tokenizers[o.mode];
  const parts: Part[] = diffArrays(tok(a), tok(b), { comparator: (l, r) => norm(l) === norm(r) })
    .map((p) => ({ value: p.value.join(''), added: p.added, removed: p.removed }));
  let added = 0, removed = 0, unchanged = 0;
  for (const p of parts) {
    const n = unit(o.mode, p.value);
    if (p.added) added += n; else if (p.removed) removed += n; else unchanged += n;
  }
  return { parts, added, removed, unchanged, identical: !added && !removed };
}
