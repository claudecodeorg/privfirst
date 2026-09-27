import { render } from 'preact';
import { App } from './App';
import { initLaunchQueue } from './lib/launchFiles';
import './styles.css';

initLaunchQueue();
render(<App />, document.getElementById('app')!);
