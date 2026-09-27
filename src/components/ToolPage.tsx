import { lazy, Suspense } from 'preact/compat';
import { useEffect, useMemo } from 'preact/hooks';
import type { Tool } from '../registry';
import { pushRecent } from '../lib/usage';

export function ToolPage({ tool }: { tool: Tool }) {
  const Component = useMemo(() => lazy(tool.load), [tool]);
  useEffect(() => { pushRecent(tool.id); }, [tool.id]);
  return (
    <main class="container">
      <a class="back" href="#/">← All tools</a>
      <h1>{tool.icon} {tool.name}</h1>
      <Suspense fallback={<p class="muted">Loading…</p>}>
        <Component />
      </Suspense>
    </main>
  );
}
