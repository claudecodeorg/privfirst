export interface JsonError { message: string; line?: number; column?: number }

function locate(text: string, error: unknown): JsonError {
  const message = error instanceof Error ? error.message : String(error);
  const m = /position (\d+)/.exec(message);
  if (!m) return { message };
  const pos = Number(m[1]);
  const before = text.slice(0, pos);
  const line = (before.match(/\n/g)?.length ?? 0) + 1;
  const column = pos - before.lastIndexOf('\n');
  return { message, line, column };
}

export function parseJson(text: string): { value: unknown } | { error: JsonError } {
  try { return { value: JSON.parse(text) }; }
  catch (e) { return { error: locate(text, e) }; }
}

export function format(text: string, indent: number): string {
  const r = parseJson(text);
  if ('error' in r) throw new Error(describeError(r.error));
  return JSON.stringify(r.value, null, indent);
}

export function minify(text: string): string {
  const r = parseJson(text);
  if ('error' in r) throw new Error(describeError(r.error));
  return JSON.stringify(r.value);
}

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as object).sort().map((k) => [k, sortKeysDeep((value as Record<string, unknown>)[k])]));
  }
  return value;
}

export function describeError(e: JsonError): string {
  return e.line ? `${e.message} (line ${e.line}, column ${e.column})` : e.message;
}
