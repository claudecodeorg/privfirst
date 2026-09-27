import { useMemo, useState } from 'preact/hooks';
import { countStats } from './logic';

export default function WordCounter() {
  const [text, setText] = useState('');
  const s = useMemo(() => countStats(text), [text]);
  const fmt = (m: number) => (m < 1 ? '< 1 min' : `${Math.round(m)} min`);

  return (
    <>
      <p class="muted">Counted on your device as you type.</p>
      <div class="card">
        <textarea rows={12} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="Paste or type your text…" />
      </div>
      <div class="card">
        <div class="stats">
          <div><b>{s.words.toLocaleString()}</b>words</div>
          <div><b>{s.characters.toLocaleString()}</b>characters</div>
          <div><b>{s.charactersNoSpaces.toLocaleString()}</b>characters (no spaces)</div>
          <div><b>{s.sentences.toLocaleString()}</b>sentences</div>
          <div><b>{s.paragraphs.toLocaleString()}</b>paragraphs</div>
          <div><b>{fmt(s.readingMinutes)}</b>reading time</div>
          <div><b>{fmt(s.speakingMinutes)}</b>speaking time</div>
        </div>
      </div>
    </>
  );
}
