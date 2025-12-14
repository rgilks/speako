import { pipeline, env } from '@huggingface/transformers';

// Configure local models path
// This allows loading models from /models/ directory in public folder
env.localModelPath = '/models/';
env.allowLocalModels = true; 
env.allowRemoteModels = true; // Fallback to remote if local not found (optional, set false for strict offline)


// Model loading state
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

function updateLoadingState(partial: Partial<ModelLoadingState>) {
  currentLoadingState = { ...currentLoadingState, ...partial };
  loadingStateCallbacks.forEach(cb => cb(currentLoadingState));
}

// Singleton to prevent multiple model loads
export class ModelSingleton {
  static instance: Promise<any> | null = null;
  static currentModelId: string | null = null;
  static preloadStarted = false;
  
  static async getInstance(modelId: string = 'Xenova/whisper-base.en', progressCallback?: (data: any) => void) {
    // If we're requesting a different model, or if we have no instance, we need to load/reload
    if (this.currentModelId !== modelId || !this.instance) {
        
      // If there was a previous instance, ideally we would dispose it here.
      // Transformers.js pipelines generally rely on garbage collection when the reference is dropped,
      // but explicitly nulling it out helps.
      if (this.instance) {
          console.log(`[ModelSingleton] Switching model from ${this.currentModelId} to ${modelId}. Dropping old instance.`);
          this.instance = null;
          updateLoadingState({ isLoaded: false, isLoading: true, progress: 0 });
      }

      this.currentModelId = modelId;
      console.log(`Loading Whisper Model: ${modelId} with WebGPU...`);
      updateLoadingState({ isLoading: true, progress: 0, modelId });

      const fileProgress: Record<string, number> = {};

      this.instance = pipeline('automatic-speech-recognition', modelId, {
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
        console.log(`Whisper model ${modelId} loaded successfully!`);
        updateLoadingState({ isLoading: false, isLoaded: true, progress: 100, modelId });
        return model;
      }).catch((error) => {
        console.error(`Failed to load Whisper model ${modelId}:`, error);
        updateLoadingState({ isLoading: false, error: String(error) });
        this.instance = null; // Reset so retry works
        this.currentModelId = null;
        throw error;
      });
    } else {
        console.log(`[ModelSingleton] Reusing existing model: ${modelId}`);
    }
    
    return this.instance;
  }
  
  static preload() {
    if (!this.preloadStarted && !this.instance) {
      this.preloadStarted = true;
      console.log("Preloading default Whisper model in background...");
      this.getInstance(); // Uses default model
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
