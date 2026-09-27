// A small, deliberately incomplete Markdown renderer: it escapes all input first, so the only HTML
// tags in the output are the ones this file generates. Raw HTML in the input is shown as text, not
// executed — a stricter (and safer) default than most Markdown libraries.
const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
    .replace(/\*([^*]+)\*|_([^_]+)_/g, (_, a, b) => `<em>${a ?? b}</em>`)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img alt="${alt}" src="${src}">`) // remote src is blocked by the app's CSP (img-src 'self' data: blob:)
    .replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function table(lines: string[]): string | null {
  if (lines.length < 2 || !/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(lines[1])) return null;
  const cells = (l: string) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = cells(lines[0]);
  const rows = lines.slice(2).map(cells);
  const th = header.map((h) => `<th>${inline(h)}</th>`).join('');
  const tr = rows.map((r) => `<tr>${header.map((_, i) => `<td>${inline(r[i] ?? '')}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

export function renderMarkdown(source: string): string {
  const escaped = escapeHtml(source).replace(/\r\n/g, '\n');
  const lines = escaped.split('\n');
  const html: string[] = [];
  let i = 0;
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  const flushList = () => { if (list) { html.push(`<${list.tag}>${list.items.map((it) => `<li>${inline(it)}</li>`).join('')}</${list.tag}>`); list = null; } };

  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const stop = lines.findIndex((l, j) => j > i && /^```/.test(l));
      const end = stop === -1 ? lines.length : stop;
      flushList();
      html.push(`<pre class="mono"><code>${lines.slice(i + 1, end).join('\n')}</code></pre>`);
      i = end + 1;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flushList(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushList(); html.push('<hr>'); i++; continue; }
    if (/^&gt;\s?/.test(line)) {
      flushList();
      const quote: string[] = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) { quote.push(lines[i].replace(/^&gt;\s?/, '')); i++; }
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ol || ul) {
      const tag = ol ? 'ol' : 'ul';
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push((ol ?? ul)![1]);
      i++; continue;
    }
    flushList();
    if (line.trim() === '') { i++; continue; }
    if (line.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') { tableLines.push(lines[i]); i++; }
      const t = table(tableLines);
      if (t) { html.push(t); continue; }
      html.push(...tableLines.map((l) => `<p>${inline(l)}</p>`));
      continue;
    }
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6})\s|^```|^\s*[-*+]\s|^\s*\d+\.\s|^&gt;/.test(lines[i])) { para.push(lines[i]); i++; }
    html.push(`<p>${inline(para.join(' '))}</p>`);
  }
  flushList();
  return html.join('\n');
}
