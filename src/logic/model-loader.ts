import { pipeline } from '@huggingface/transformers';

// Model loading state
export interface ModelLoadingState {
  isLoading: boolean;
  isLoaded: boolean;
  progress: number; // 0-100
  error: string | null;
}

type LoadingStateCallback = (state: ModelLoadingState) => void;
const loadingStateCallbacks: LoadingStateCallback[] = [];
let currentLoadingState: ModelLoadingState = {
  isLoading: false,
  isLoaded: false,
  progress: 0,
  error: null,
};

function updateLoadingState(partial: Partial<ModelLoadingState>) {
  currentLoadingState = { ...currentLoadingState, ...partial };
  loadingStateCallbacks.forEach(cb => cb(currentLoadingState));
}

// Singleton to prevent multiple model loads
export class ModelSingleton {
  static instance: Promise<any> | null = null;
  static preloadStarted = false;
  
  static getInstance(progressCallback?: (data: any) => void) {
    if (!this.instance) {
      console.log("Loading Whisper Base with WebGPU...");
      updateLoadingState({ isLoading: true, progress: 0 });

      const fileProgress: Record<string, number> = {};

      // Using whisper-base.en for better accuracy than distil-small
      // It is larger (~150MB) but avoids the "hallucination" issues on short phrases.
      this.instance = pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
        progress_callback: (data: any) => {
          if (data.status === 'progress' && data.progress !== undefined) {
            const fileName = data.file || 'model';
            fileProgress[fileName] = data.progress || 0;
            const entries = Object.entries(fileProgress);
            
            // 99% of download size is the main model file for accurate progress
            let totalWeightedProgress = 0;
            let totalWeight = 0;

            for (const [file, progress] of entries) {
                const isMainModel = file.includes("model.onnx") || file.includes("model.safetensors") || file.endsWith(".bin");
                const weight = isMainModel ? 100 : 1;
                
                totalWeightedProgress += progress * weight;
                totalWeight += weight;
            }

            const overallProgress = Math.round(totalWeightedProgress / Math.max(totalWeight, 1));
            updateLoadingState({ progress: overallProgress });
          } else if (data.status === 'initiate') {
            updateLoadingState({ progress: Math.max(currentLoadingState.progress, 10) });
          } else if (data.status === 'download') {
            updateLoadingState({ progress: Math.max(currentLoadingState.progress, 20) });
          } else if (data.status === 'done') {
            updateLoadingState({ progress: Math.max(currentLoadingState.progress, 80) });
          } else if (data.status === 'ready') {
            updateLoadingState({ progress: 95 });
          }
          
          progressCallback?.(data);
        },
        device: 'webgpu',
        dtype: 'fp32',
      }).then((model) => {
        console.log("Whisper model loaded successfully!");
        updateLoadingState({ isLoading: false, isLoaded: true, progress: 100 });
        return model;
      }).catch((error) => {
        console.error("Failed to load Whisper model:", error);
        updateLoadingState({ isLoading: false, error: String(error) });
        throw error;
      });
    }
    return this.instance;
  }
  
  static preload() {
    if (!this.preloadStarted && !this.instance) {
      this.preloadStarted = true;
      console.log("Preloading Whisper model in background...");
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

// Start preloading
export function preloadTranscriptionModel() {
  ModelSingleton.preload();
}
