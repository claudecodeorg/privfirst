import { useMemo, useState } from 'preact/hooks';
import { downloadBlob } from '../../lib/download';
import { renderMarkdown } from './logic';

const SAMPLE = `# PrivFirst

**Bold**, *italic*, and \`inline code\`.

- One
- Two

> Everything renders on your device.

| Tool | Local |
|---|---|
| This one | Yes |
`;

export default function MarkdownPreview() {
  const [text, setText] = useState(SAMPLE);
  const html = useMemo(() => renderMarkdown(text), [text]);

  return (
    <>
      <p class="muted">Renders Markdown on your device. Raw HTML in the source is shown as text, not run, and remote images are blocked by this app's security policy.</p>
      <div class="row">
        <label class="field" style="flex:1 1 320px">Markdown
          <textarea rows={16} class="mono" value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
        </label>
        <div class="field" style="flex:1 1 320px">
          Preview
          <div class="card" style="margin:0;max-height:400px;overflow:auto" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
      <div class="card">
        <div class="row">
          <button onClick={() => void navigator.clipboard?.writeText(html)}>Copy HTML</button>
          <button onClick={() => downloadBlob(new Blob([text]), 'document.md')}>Download .md</button>
          <button onClick={() => downloadBlob(new Blob([`<!doctype html><meta charset="utf-8"><title>Document</title>\n${html}`]), 'document.html')}>Download .html</button>
        </div>
      </div>
    </>
  );
}
