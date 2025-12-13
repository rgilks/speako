import { pipeline } from '@huggingface/transformers';
import { ITranscriber, TranscriptionResult } from './transcriber';
import { AudioRecorder } from './audio';

// Model loading state
export interface ModelLoadingState {
  isLoading: boolean;
  isLoaded: boolean;
  progress: number; // 0-100
  error: string | null;
}

// Callbacks for loading state updates
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
class ModelSingleton {
  static instance: Promise<any> | null = null;
  static preloadStarted = false;
  
  static getInstance(progressCallback?: (data: any) => void) {
    if (!this.instance) {
      console.log("Loading Distil-Whisper Small with WebGPU...");
      updateLoadingState({ isLoading: true, progress: 0 });

      // Track per-file progress
      const fileProgress: Record<string, number> = {};

      // Using whisper-base.en for better accuracy than distil-small
      // It is larger (~150MB) but avoids the "hallucination" issues on short phrases.
      this.instance = pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
        progress_callback: (data: any) => {
          // Handle different loading stages
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
            // Starting to load a file
            updateLoadingState({ progress: Math.max(currentLoadingState.progress, 10) });
          } else if (data.status === 'download') {
            // Downloading (for uncached files)
            updateLoadingState({ progress: Math.max(currentLoadingState.progress, 20) });
          } else if (data.status === 'done') {
            // A file finished loading
            updateLoadingState({ progress: Math.max(currentLoadingState.progress, 80) });
          } else if (data.status === 'ready') {
            // Model is ready
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

// Subscribe to loading state changes
export function subscribeToLoadingState(callback: LoadingStateCallback): () => void {
  loadingStateCallbacks.push(callback);
  // Immediately call with current state
  callback(currentLoadingState);
  // Return unsubscribe function
  return () => {
    const index = loadingStateCallbacks.indexOf(callback);
    if (index > -1) loadingStateCallbacks.splice(index, 1);
  };
}

// Get current loading state
export function getLoadingState(): ModelLoadingState {
  return currentLoadingState;
}

// Start preloading
export function preloadTranscriptionModel() {
  ModelSingleton.preload();
}

export class LocalTranscriber implements ITranscriber {
  private recorder = new AudioRecorder();
  private model: any = null;
  public onProgress?: (msg: string) => void;
  private isTranscriptionActive = false;
  private accumulatedChunks: Blob[] = [];
  
  /**
   * Get the audio recorder instance for level monitoring
   */
  getRecorder(): AudioRecorder {
    return this.recorder;
  }

  async start(deviceId?: string): Promise<void> {
    this.isTranscriptionActive = true;
    this.accumulatedChunks = [];
    
    if (!this.model) {
      this.onProgress?.("Loading model...");
      
      // Track progress across multiple model files to avoid flickering
      const fileProgress: Record<string, number> = {};
      let lastDisplayedProgress = -1;
      
      this.model = await ModelSingleton.getInstance((data: any) => {
        if (data.status === 'progress' && this.onProgress) {
          // Track each file's progress separately
          const fileName = data.file || 'model';
          fileProgress[fileName] = data.progress || 0;
          
          // Calculate overall progress (average of all files)
          // Calculate weighted progress
          const entries = Object.entries(fileProgress);
          let totalWeightedProgress = 0;
          let totalWeight = 0;

          for (const [file, progress] of entries) {
              const isMainModel = file.includes("model.onnx") || file.includes("model.safetensors") || file.endsWith(".bin");
              const weight = isMainModel ? 100 : 1;
              
              totalWeightedProgress += progress * weight;
              totalWeight += weight;
          }

          const overallProgress = Math.round(totalWeightedProgress / Math.max(totalWeight, 1));
          
          // Only update if progress changed (reduces flickering)
          if (overallProgress !== lastDisplayedProgress) {
            lastDisplayedProgress = overallProgress;
            this.onProgress(`Downloading model... ${overallProgress}%`);
          }
        } else if (data.status === 'ready') {
          this.onProgress?.("Model loaded!");
        }
      });
    }
    
    // Check if we were cancelled during load
    if (!this.isTranscriptionActive) {
        console.warn("[LocalTranscriber] Start cancelled (stopped during load).");
        return;
    }

    this.onProgress?.("Recording...");
    await this.recorder.start(deviceId);
  }

  async stop(): Promise<TranscriptionResult> {
    this.isTranscriptionActive = false;
    
    this.onProgress?.("Processing...");
    let audioBlob: Blob;
    try {
        audioBlob = await this.recorder.stop();
    } catch (e) {
        if (e === "Recorder not started" || (typeof e === 'string' && e.includes("not started"))) {
            console.warn("Stop called but recorder was not started (likely cancelled during model load).");
            return { text: "", words: [] };
        }
        throw e;
    }
    
    // transformers.js expects a Float32Array or a URL to the audio.
    // Creating a URL is easiest for WebM blobs.
    const url = URL.createObjectURL(audioBlob);
    
    try {
      // Transcribe the audio without timestamps (simpler and more reliable)
      const output = await this.model(url);
      URL.revokeObjectURL(url);
      
      let text = "";
      let words: any[] = [];

      if (typeof output === 'object') {
        text = output.text?.trim() || "";
        if (output.chunks) {
            console.log("Fluency Data (Chunks):", output.chunks);
            // Extract words from chunks (phrase-level for distil models)
            words = output.chunks.map((c: any) => ({
                word: c.text.trim(),
                start: c.timestamp?.[0] ?? 0,
                end: c.timestamp?.[1] ?? 0,
                score: c.score || 0.99 // Fallback confidence if not provided
            }));
        }
      } else if (Array.isArray(output) && output[0] && output[0].text) {
         text = output[0].text.trim();
      }
      
      return { text, words };
    } catch (e) {
      console.error("Transcription error:", e);
      return { text: "[Error during transcription]", words: [] };
    }
  }
}

