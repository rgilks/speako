import { render } from 'preact';
import { App } from './app';
import { env } from '@huggingface/transformers';
import { preloadTranscriptionModel } from './logic/local-transcriber';
import './index.css';

const APP_ROOT_ID = 'app';

env.allowLocalModels = false;
env.useBrowserCache = true;

preloadTranscriptionModel();

render(<App />, document.getElementById(APP_ROOT_ID) as HTMLElement);
