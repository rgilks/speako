import { pipeline, env } from '@xenova/transformers';
import { ITranscriber, TranscriptionResult } from './transcriber';
import { AudioRecorder } from './audio';

// Configure transformers.js to use the remote Hugging Face Hub
// This prevents it from checking the local server (and getting 404 -> index.html)
// Singleton to prevent multiple model loads
class ModelSingleton {
  static instance: Promise<any> | null = null;
  static getInstance(progressCallback?: (data: any) => void) {
    if (!this.instance) {
      console.log("Loading Whisper Tiny...");
      console.log("env.allowLocalModels:", env.allowLocalModels);
      
      
      try {
        // Suppress ONNX Runtime warnings (like "Removing initializer...")
        // @ts-ignore
        if (env.backends && env.backends.onnx) {
            env.backends.onnx.logLevel = 'error';
        }
      } catch (e) {
        console.warn("Failed to set ONNX log level:", e);
      }

      // Robust fallback: Intercept console.warn/log to filter out specific ONNX noise
      const originalWarn = console.warn;
      console.warn = (...args) => {
          if (args.length > 0 && typeof args[0] === 'string' && 
              (args[0].includes("CleanUnusedInitializersAndNodeArgs") || args[0].includes("Removing initializer"))) {
              return;
          }
          originalWarn.apply(console, args);
      };

      this.instance = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        progress_callback: progressCallback
      });
    }
    return this.instance;
  }
}

export class LocalTranscriber implements ITranscriber {
  private recorder = new AudioRecorder();
  private model: any = null;
  public onProgress?: (msg: string) => void;
  private isTranscriptionActive = false;

  async start(): Promise<void> {
    this.isTranscriptionActive = true;
    if (!this.model) {
      this.onProgress?.("Loading model...");
      this.model = await ModelSingleton.getInstance((data: any) => {
        if (data.status === 'progress' && this.onProgress) {
            this.onProgress(`Downloading... ${Math.round(data.progress || 0)}%`);
        }
      });
    }
    
    // Check if we were cancelled during load
    if (!this.isTranscriptionActive) {
        console.warn("[LocalTranscriber] Start cancelled (stopped during load).");
        return;
    }

    this.onProgress?.("Recording...");
    await this.recorder.start();
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
      // Request word-level timestamps for fluency analysis
      const output = await this.model(url, { return_timestamps: 'word' });
      URL.revokeObjectURL(url);
      
      let text = "";
      let words: any[] = [];

      if (typeof output === 'object') {
        text = output.text?.trim() || "";
        if (output.chunks) {
            console.log("Fluency Data (Chunks):", output.chunks);
            words = output.chunks.map((c: any) => ({
                word: c.text.trim(),
                start: c.timestamp[0],
                end: c.timestamp[1],
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
