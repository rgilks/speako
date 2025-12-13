import { render } from 'preact';
import { App } from './app';
import { env } from '@huggingface/transformers';
import { preloadTranscriptionModel } from './logic/local-transcriber';
import './index.css';

// Force usage of remote Hugging Face Hub (prevent local 404s)
env.allowLocalModels = false;
// Enable browser cache for faster subsequent loads
env.useBrowserCache = true;

// Start preloading the model immediately in the background
// This way it's ready (or mostly downloaded) by the time user clicks record
preloadTranscriptionModel();

render(<App />, document.getElementById('app') as HTMLElement);
