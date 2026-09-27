import { useMemo, useState } from 'preact/hooks';
import { CITIES, formatOffset, isReasonableHour, localHour, localZone, offsetMinutes } from './logic';

const STORAGE_KEY = 'privfirst.timezone-planner.pinned';
const readPinned = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const writePinned = (zones: string[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(zones)); } catch { /* ignore */ } };

export default function TimezonePlanner() {
  const home = useMemo(localZone, []);
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [pinned, setPinned] = useState<string[]>(() => {
    const saved = readPinned();
    return saved.length ? saved : CITIES.filter((c) => ['UTC', 'Europe/London', 'Asia/Kolkata', 'America/New_York'].includes(c.zone)).map((c) => c.zone);
  });

  const date = when ? new Date(when) : null;
  const add = (zone: string) => { if (!pinned.includes(zone)) { const next = [...pinned, zone]; setPinned(next); writePinned(next); } };
  const remove = (zone: string) => { const next = pinned.filter((z) => z !== zone); setPinned(next); writePinned(next); };
  const cityFor = (zone: string) => CITIES.find((c) => c.zone === zone) ?? { zone, label: zone };

  return (
    <>
      <p class="muted">Compares a time across cities, entirely on your device. Your home zone is detected as {home}.</p>
      <div class="card">
        <label>Date &amp; time (in {home})
          <input type="datetime-local" value={when} onInput={(e) => setWhen((e.target as HTMLInputElement).value)} />
        </label>
        <button style="margin-left:8px" onClick={() => { const d = new Date(); d.setSeconds(0, 0); setWhen(d.toISOString().slice(0, 16)); }}>Now</button>
      </div>
      {date && !Number.isNaN(date.getTime()) && (
        <div class="card">
          {pinned.map((zone) => {
            const city = cityFor(zone);
            const hour = localHour(date, zone);
            const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(date);
            return (
              <div class="row" key={zone} style="align-items:center;margin-bottom:8px">
                <strong style="flex:1">{city.label}</strong>
                <span class={isReasonableHour(hour) ? '' : 'muted'}>{fmt} · {formatOffset(offsetMinutes(date, zone))}</span>
                <button class="danger" aria-label={`Remove ${city.label}`} onClick={() => remove(zone)}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      <div class="card">
        <label>Add a city
          <select value="" onChange={(e) => { add((e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }}>
            <option value="" disabled>Choose…</option>
            {CITIES.filter((c) => !pinned.includes(c.zone)).map((c) => <option value={c.zone} key={c.zone}>{c.label}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}
