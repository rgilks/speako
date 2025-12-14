import { ITranscriber, TranscriptionResult } from './transcriber';
import { AudioRecorder } from './audio';
import { ModelSingleton } from './model-loader';

export { subscribeToLoadingState, getLoadingState, preloadTranscriptionModel } from './model-loader';
export type { ModelLoadingState } from './model-loader';

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
          const fileName = data.file || 'model';
          fileProgress[fileName] = data.progress || 0;
          
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
    
    // transformers.js expects a Float32Array or a URL.
    const url = URL.createObjectURL(audioBlob);
    
    try {
      const output = await this.model(url, { return_timestamps: true });
      URL.revokeObjectURL(url);
      
      let text = "";
      let words: any[] = [];

      if (typeof output === 'object') {
        text = output.text?.trim() || "";
        if (output.chunks) {
            console.log("Fluency Data (Chunks):", output.chunks);
            // Extract words from chunks
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

