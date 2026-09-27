import { useState } from 'preact/hooks';
import { categories, searchTools, tools, type Category } from '../registry';
import { getFavourites, getRecent, toggleFavourite } from '../lib/usage';

export function Home() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [favourites, setFavourites] = useState<string[]>(getFavourites);
  const recent = getRecent().map((id) => tools.find((t) => t.id === id)).filter((t): t is (typeof tools)[number] => !!t).slice(0, 6);

  const results = searchTools(q, category)
    .slice()
    .sort((a, b) => Number(favourites.includes(b.id)) - Number(favourites.includes(a.id)));

  const star = (id: string) => (e: Event) => { e.preventDefault(); setFavourites(toggleFavourite(id)); };

  const Tile = ({ t }: { t: (typeof tools)[number] }) => (
    <a class="tile" href={`#/${t.id}`} key={t.id}>
      <button class={`fav${favourites.includes(t.id) ? ' on' : ''}`} aria-label={favourites.includes(t.id) ? 'Remove from favourites' : 'Add to favourites'} onClick={star(t.id)}>
        {favourites.includes(t.id) ? '★' : '☆'}
      </button>
      <span class="tile-icon" aria-hidden="true">{t.icon}</span>
      <strong>{t.name}</strong>
      <span class="muted">{t.description}</span>
    </a>
  );

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
      <div class="chips" role="group" aria-label="Category">
        <button aria-pressed={category === null} onClick={() => setCategory(null)}>All</button>
        {categories.map((c) => <button key={c} aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>{c}</button>)}
      </div>
      {!q && !category && recent.length > 0 && (
        <>
          <h2 class="section-title">Recently used</h2>
          <div class="grid">{recent.map((t) => <Tile t={t} key={t.id} />)}</div>
        </>
      )}
      {(!q && !category && recent.length > 0) && <h2 class="section-title">All tools</h2>}
      <div class="grid">
        {results.map((t) => <Tile t={t} key={t.id} />)}
      </div>
      {!results.length && <p class="muted center">No tools match “{q}”.</p>}
      <footer class="muted center" style="margin-top:32px;font-size:.85rem">
        <a href="privacy.html">Privacy Policy</a>
      </footer>
    </main>
  );
}
