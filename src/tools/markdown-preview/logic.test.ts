import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './logic';

describe('renderMarkdown', () => {
  it('renders headings', () => {
    expect(renderMarkdown('# Title')).toBe('<h1>Title</h1>');
    expect(renderMarkdown('### Sub')).toBe('<h3>Sub</h3>');
  });
  it('renders bold, italic and inline code', () => {
    expect(renderMarkdown('**bold** and *italic* and `code`')).toBe('<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>');
  });
  it('renders links and blocks remote images via the CSP, not the renderer', () => {
    expect(renderMarkdown('[click](https://example.com)')).toBe('<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">click</a></p>');
    expect(renderMarkdown('![alt](https://example.com/x.png)')).toContain('<img alt="alt" src="https://example.com/x.png">');
  });
  it('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
  });
  it('renders a fenced code block verbatim, without inline formatting applied inside', () => {
    expect(renderMarkdown('```\nlet x = *1*;\n```')).toBe('<pre class="mono"><code>let x = *1*;</code></pre>');
  });
  it('renders a blockquote and a horizontal rule', () => {
    expect(renderMarkdown('> hello')).toBe('<blockquote>hello</blockquote>');
    expect(renderMarkdown('---')).toBe('<hr>');
  });
  it('renders a GFM-style table', () => {
    const out = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(out).toContain('<th>a</th>');
    expect(out).toContain('<td>1</td>');
  });
  it('joins consecutive lines into one paragraph, and blank lines separate paragraphs', () => {
    expect(renderMarkdown('line one\nline two\n\nsecond para')).toBe('<p>line one line two</p>\n<p>second para</p>');
  });

  describe('escaping raw HTML (the security-critical part)', () => {
    it('escapes a script tag instead of emitting it', () => {
      const out = renderMarkdown('<script>alert(1)</script>');
      expect(out).not.toContain('<script>');
      expect(out).toContain('&lt;script&gt;');
    });
    it('escapes an inline event handler attribute typed as plain text', () => {
      const out = renderMarkdown('<img src=x onerror=alert(1)>');
      expect(out).not.toMatch(/<img src=x/);
      expect(out).toContain('&lt;img');
    });
    it('escapes HTML that appears inside emphasis/code too', () => {
      expect(renderMarkdown('**<b>bold</b>**')).not.toContain('<b>');
    });
  });
});
