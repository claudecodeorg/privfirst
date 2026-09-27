// Favourites and recently-used tools, kept in localStorage. Falls back to an in-memory map when
// localStorage isn't available (private browsing, or these unit tests running in Node).
const memory = new Map<string, string>();
const getItem = (key: string): string | null => {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : (memory.get(key) ?? null); }
  catch { return memory.get(key) ?? null; }
};
const setItem = (key: string, value: string) => {
  try { if (typeof localStorage !== 'undefined') { localStorage.setItem(key, value); return; } } catch { /* fall through to memory */ }
  memory.set(key, value);
};

const FAV_KEY = 'privfirst.favourites';
const RECENT_KEY = 'privfirst.recent';
const MAX_RECENT = 8;

function readIds(key: string): string[] {
  try {
    const v = JSON.parse(getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

export function getFavourites(): string[] { return readIds(FAV_KEY); }
export function isFavourite(id: string): boolean { return getFavourites().includes(id); }
export function toggleFavourite(id: string): string[] {
  const cur = getFavourites();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

export function getRecent(): string[] { return readIds(RECENT_KEY); }
export function pushRecent(id: string): string[] {
  const next = [id, ...getRecent().filter((x) => x !== id)].slice(0, MAX_RECENT);
  setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}
