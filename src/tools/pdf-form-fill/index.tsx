import { useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { fillForm, listFields, type FieldInfo, type FieldValues } from './logic';

export default function PdfFormFill() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fields, setFields] = useState<FieldInfo[] | null>(null);
  const [values, setValues] = useState<FieldValues>({});
  const [flatten, setFlatten] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = async (f: File) => {
    setFile(f); setFields(null); setError(''); setValues({});
    try { const b = new Uint8Array(await f.arrayBuffer()); setBytes(b); setFields(await listFields(b)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const submit = async () => {
    if (!bytes || !file) return;
    setBusy(true); setError('');
    try {
      const out = await fillForm(bytes, values, flatten);
      downloadBlob(new Blob([out as BlobPart], { type: 'application/pdf' }), file.name.replace(/\.pdf$/i, '') + '-filled.pdf');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const set = (name: string, v: string | boolean | string[]) => setValues({ ...values, [name]: v });

  return (
    <>
      <p class="muted">Fills in a PDF's form fields on your device.</p>
      <div class="card">
        <input type="file" accept="application/pdf" onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void open(f); }} />
      </div>
      {error && <p class="error" role="alert">{error}</p>}
      {fields && (fields.length === 0 ? (
        <p class="muted">This PDF has no fillable form fields.</p>
      ) : (
        <div class="card">
          {fields.map((f) => (
            <label key={f.name} class="field" style="margin-bottom:12px">
              {f.name}
              {f.kind === 'text' && <input value={typeof values[f.name] === 'string' ? values[f.name] as string : ''} onInput={(e) => set(f.name, (e.target as HTMLInputElement).value)} />}
              {f.kind === 'checkbox' && (
                <span style="display:flex;align-items:center;gap:8px">
                  <input type="checkbox" style="min-height:auto" checked={!!values[f.name]} onChange={(e) => set(f.name, (e.target as HTMLInputElement).checked)} />
                </span>
              )}
              {(f.kind === 'dropdown' || f.kind === 'radio') && (
                <select value={typeof values[f.name] === 'string' ? values[f.name] as string : ''} onChange={(e) => set(f.name, (e.target as HTMLSelectElement).value)}>
                  <option value="">—</option>
                  {f.options?.map((o) => <option value={o} key={o}>{o}</option>)}
                </select>
              )}
              {f.kind === 'optionList' && (
                <select multiple onChange={(e) => set(f.name, Array.from((e.target as HTMLSelectElement).selectedOptions).map((o) => o.value))}>
                  {f.options?.map((o) => <option value={o} key={o} selected={(Array.isArray(values[f.name]) ? values[f.name] as string[] : []).includes(o)}>{o}</option>)}
                </select>
              )}
            </label>
          ))}
          <label style="flex-direction:row;align-items:center;gap:8px;display:flex;margin:12px 0">
            <input type="checkbox" checked={flatten} style="min-height:auto" onChange={(e) => setFlatten((e.target as HTMLInputElement).checked)} />
            Make permanent (flatten — fields can no longer be edited afterwards)
          </label>
          <button class="primary" disabled={busy} onClick={submit}>{busy ? 'Working…' : 'Fill & Download'}</button>
        </div>
      ))}
    </>
  );
}
