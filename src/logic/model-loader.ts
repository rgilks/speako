import { pipeline, env } from '@huggingface/transformers';
import { checkWebGPU } from './webgpu-check';

env.localModelPath = '/models/';
env.allowLocalModels = true;
env.allowRemoteModels = true;

const DEFAULT_MODEL_ID = 'Xenova/whisper-base';
const MAIN_MODEL_WEIGHT = 100;
const OTHER_FILE_WEIGHT = 1;
const PROGRESS_INITIATE = 10;
const PROGRESS_DOWNLOAD = 20;
const PROGRESS_DONE = 80;
const PROGRESS_READY = 95;
const PROGRESS_COMPLETE = 100;

let activeDevice: 'webgpu' | 'wasm' = 'webgpu';

export function getActiveDevice(): 'webgpu' | 'wasm' {
  return activeDevice;
}

export interface ModelLoadingState {
  isLoading: boolean;
  isLoaded: boolean;
  progress: number; // 0-100
  error: string | null;
  modelId?: string;
}

type LoadingStateCallback = (state: ModelLoadingState) => void;
const loadingStateCallbacks: LoadingStateCallback[] = [];
let currentLoadingState: ModelLoadingState = {
  isLoading: false,
  isLoaded: false,
  progress: 0,
  error: null,
};

function updateLoadingState(partial: Partial<ModelLoadingState>): void {
  currentLoadingState = { ...currentLoadingState, ...partial };
  loadingStateCallbacks.forEach((cb) => cb(currentLoadingState));
}

export function isMainModelFile(fileName: string): boolean {
  return (
    fileName.includes('model.onnx') ||
    fileName.includes('model.safetensors') ||
    fileName.endsWith('.bin')
  );
}

export function calculateWeightedProgress(fileProgress: Record<string, number>): number {
  let totalWeightedProgress = 0;
  let totalWeight = 0;

  for (const [file, progress] of Object.entries(fileProgress)) {
    const weight = isMainModelFile(file) ? MAIN_MODEL_WEIGHT : OTHER_FILE_WEIGHT;
    totalWeightedProgress += progress * weight;
    totalWeight += weight;
  }

  return Math.round(totalWeightedProgress / Math.max(totalWeight, 1));
}

interface ProgressData {
  status: 'progress' | 'initiate' | 'download' | 'done' | 'ready';
  file?: string;
  progress?: number;
}

function createProgressCallback(
  fileProgress: Record<string, number>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  progressCallback?: (data: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (data: any) => void {
  return (data: ProgressData) => {
    if (data.status === 'progress' && data.progress !== undefined) {
      const fileName = data.file || 'model';
      fileProgress[fileName] = data.progress || 0;
      const overallProgress = calculateWeightedProgress(fileProgress);
      updateLoadingState({ progress: overallProgress });
    } else if (data.status === 'initiate') {
      updateLoadingState({ progress: Math.max(currentLoadingState.progress, PROGRESS_INITIATE) });
    } else if (data.status === 'download') {
      updateLoadingState({ progress: Math.max(currentLoadingState.progress, PROGRESS_DOWNLOAD) });
    } else if (data.status === 'done') {
      updateLoadingState({ progress: Math.max(currentLoadingState.progress, PROGRESS_DONE) });
    } else if (data.status === 'ready') {
      updateLoadingState({ progress: PROGRESS_READY });
    }

    progressCallback?.(data);
  };
}

async function loadWithDevice(
  modelId: string,
  device: 'webgpu' | 'wasm',
  fileProgress: Record<string, number>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  progressCallback?: (data: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  return await pipeline('automatic-speech-recognition', modelId, {
    progress_callback: createProgressCallback(fileProgress, progressCallback),
    device,
    dtype: device === 'webgpu' ? 'fp32' : 'q8',
  });
}

export class ModelSingleton {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static instance: Promise<any> | null = null;
  static currentModelId: string | null = null;
  static preloadStarted = false;

  static async getInstance(
    modelId: string = DEFAULT_MODEL_ID,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    progressCallback?: (data: any) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    if (this.currentModelId !== modelId || !this.instance) {
      if (this.instance) {
        console.log(`[ModelSingleton] Switching model from ${this.currentModelId} to ${modelId}.`);
        this.instance = null;
        updateLoadingState({ isLoaded: false, isLoading: true, progress: 0 });
      }

      this.currentModelId = modelId;

      this.instance = (async () => {
        const webGpuStatus = await checkWebGPU();
        let device: 'webgpu' | 'wasm' = webGpuStatus.isAvailable ? 'webgpu' : 'wasm';
        activeDevice = device;

        console.log(
          `Loading Whisper Model: ${modelId} with ${device.toUpperCase()}${device === 'wasm' ? ' (WebGPU unavailable)' : ''}...`
        );
        updateLoadingState({ isLoading: true, progress: 0, modelId });

        const fileProgress: Record<string, number> = {};

        try {
          let model;
          try {
            model = await loadWithDevice(modelId, device, fileProgress, progressCallback);
          } catch (webgpuError) {
            if (device === 'webgpu') {
              console.warn('WebGPU failed, falling back to WASM:', webgpuError);
              device = 'wasm';
              activeDevice = 'wasm';
              updateLoadingState({ progress: 0 });
              model = await loadWithDevice(modelId, 'wasm', fileProgress, progressCallback);
            } else {
              throw webgpuError;
            }
          }

          console.log(`Whisper model ${modelId} loaded successfully with ${device.toUpperCase()}!`);
          updateLoadingState({
            isLoading: false,
            isLoaded: true,
            progress: PROGRESS_COMPLETE,
            modelId,
          });
          return model;
        } catch (error) {
          console.error(`Failed to load Whisper model ${modelId}:`, error);
          updateLoadingState({ isLoading: false, error: String(error) });
          ModelSingleton.instance = null;
          ModelSingleton.currentModelId = null;
          throw error;
        }
      })();
    } else {
      console.log(`[ModelSingleton] Reusing existing model: ${modelId}`);
    }

    return this.instance;
  }

  static preload(): void {
    if (!this.preloadStarted && !this.instance) {
      this.preloadStarted = true;
      console.log('Preloading default Whisper model in background...');
      this.getInstance();
    }
  }
}

export function subscribeToLoadingState(callback: LoadingStateCallback): () => void {
  loadingStateCallbacks.push(callback);
  callback(currentLoadingState);
  return () => {
    const index = loadingStateCallbacks.indexOf(callback);
    if (index > -1) loadingStateCallbacks.splice(index, 1);
  };
}

export function getLoadingState(): ModelLoadingState {
  return currentLoadingState;
}

export function preloadTranscriptionModel(): void {
  ModelSingleton.preload();
}
