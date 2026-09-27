import { useMemo, useState } from 'preact/hooks';
import { COMMON_ZONES, dateToEpoch, formatInZone, localTimeZone, parseFlexible, type Unit } from './logic';

export default function TimestampConverter() {
  const [epoch, setEpoch] = useState(() => String(Math.floor(Date.now() / 1000)));
  const [unit, setUnit] = useState<Unit>('s');
  const [freeform, setFreeform] = useState('');
  const local = useMemo(localTimeZone, []);
  const [zones, setZones] = useState<string[]>(() => [...new Set(['UTC', local])]);

  const date = useMemo(() => {
    try { return parseFlexible(epoch.trim() === '' ? '' : epoch); } catch { return null; }
  }, [epoch]);

  const fromFree = () => {
    try { const d = parseFlexible(freeform); setEpoch(String(dateToEpoch(d, unit))); }
    catch { /* leave epoch as-is; the error shows via the empty result below */ }
  };
  const freeformError = freeform.trim() && (() => { try { parseFlexible(freeform); return ''; } catch (e) { return e instanceof Error ? e.message : String(e); } })();

  return (
    <>
      <p class="muted">Converts between Unix time and calendar dates, in any time zone, on your device.</p>
      <div class="card">
        <div class="row">
          <label>Epoch<input class="mono" value={epoch} onInput={(e) => setEpoch((e.target as HTMLInputElement).value)} /></label>
          <label>Unit
            <select value={unit} onChange={(e) => setUnit((e.target as HTMLSelectElement).value as Unit)}>
              <option value="s">Seconds</option><option value="ms">Milliseconds</option>
            </select>
          </label>
          <button onClick={() => setEpoch(String(unit === 's' ? Math.floor(Date.now() / 1000) : Date.now()))}>Now</button>
        </div>
        {!date && epoch.trim() && <p class="error">Not a valid epoch value.</p>}
      </div>
      <div class="card">
        <label class="field">Or parse a date/time string
          <input value={freeform} placeholder="2025-01-01T12:00:00Z, or paste any date" onInput={(e) => setFreeform((e.target as HTMLInputElement).value)} />
        </label>
        {freeformError && <p class="error">{freeformError}</p>}
        <p><button class="primary" disabled={!freeform.trim() || !!freeformError} onClick={fromFree}>Convert to epoch</button></p>
      </div>
      {date && (
        <div class="card">
          <div class="stats">
            {zones.map((z) => (
              <div key={z}>
                <b>{formatInZone(date, z)}</b>{z}
                {zones.length > 1 && <button aria-label={`Remove ${z}`} class="danger" style="margin-left:8px;padding:0 6px;min-height:auto" onClick={() => setZones(zones.filter((x) => x !== z))}>✕</button>}
              </div>
            ))}
          </div>
          <div class="row" style="margin-top:12px">
            <label>Add time zone
              <select value="" onChange={(e) => { const z = (e.target as HTMLSelectElement).value; if (z && !zones.includes(z)) setZones([...zones, z]); (e.target as HTMLSelectElement).value = ''; }}>
                <option value="" disabled>Choose…</option>
                {COMMON_ZONES.filter((z) => !zones.includes(z)).map((z) => <option value={z} key={z}>{z}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
