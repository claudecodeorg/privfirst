import { useEffect, useState } from 'preact/hooks';
import { Home } from './components/Home';
import { ToolPage } from './components/ToolPage';
import { tools } from './registry';

// Hash routing works on any static host and in installed PWAs without server config.
function useHashRoute(): string {
  const read = () => location.hash.replace(/^#\/?/, '');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const route = useHashRoute();
  const tool = tools.find((t) => t.id === route);
  return tool ? <ToolPage key={tool.id} tool={tool} /> : <Home />;
}
