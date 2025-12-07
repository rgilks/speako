import { render } from 'preact';
import { App } from './app';
import { env } from '@xenova/transformers';
import './index.css';

// Force usage of remote Hugging Face Hub (prevent local 404s)
env.allowLocalModels = false;
// Disable cache temporarily to prevent reading corrupted (HTML-as-JSON) files from previous runs
env.useBrowserCache = true;

render(<App />, document.getElementById('app') as HTMLElement);
