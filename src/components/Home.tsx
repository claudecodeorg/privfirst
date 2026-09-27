import { useState } from 'preact/hooks';
import { searchTools } from '../registry';

export function Home() {
  const [q, setQ] = useState('');
  const results = searchTools(q);
  return (
    <main class="container">
      <header class="hero">
        <h1>PrivFirst</h1>
        <p>Useful tools that run entirely on your device. No accounts, no uploads, no tracking.</p>
      </header>
      <input
        class="search"
        type="search"
        placeholder="Search tools…"
        aria-label="Search tools"
        value={q}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        autofocus
      />
      <div class="grid">
        {results.map((t) => (
          <a class="tile" href={`#/${t.id}`} key={t.id}>
            <span class="tile-icon" aria-hidden="true">{t.icon}</span>
            <strong>{t.name}</strong>
            <span class="muted">{t.description}</span>
          </a>
        ))}
      </div>
      {!results.length && <p class="muted center">No tools match “{q}”.</p>}
    </main>
  );
}
