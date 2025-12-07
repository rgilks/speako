import { pipeline, env } from '@xenova/transformers';
import { ITranscriber } from './transcriber';
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

  async start(): Promise<void> {
    if (!this.model) {
      this.onProgress?.("Loading model...");
      this.model = await ModelSingleton.getInstance((data: any) => {
        if (data.status === 'progress' && this.onProgress) {
            this.onProgress(`Downloading... ${Math.round(data.progress || 0)}%`);
        }
      });
    }
    this.onProgress?.("Recording...");
    await this.recorder.start();
  }

  async stop(): Promise<string> {
    this.onProgress?.("Processing...");
    const audioBlob = await this.recorder.stop();
    
    // transformers.js expects a Float32Array or a URL to the audio.
    // Creating a URL is easiest for WebM blobs.
    const url = URL.createObjectURL(audioBlob);
    
    try {
      // Request word-level timestamps for fluency analysis
      const output = await this.model(url, { return_timestamps: 'word' });
      URL.revokeObjectURL(url);
      
      // The output structure with timestamps is { text: "...", chunks: [{ text: "word", timestamp: [start, end] }] }
      // For now we just return the text, but log the chunks for debugging/future use.
      if (typeof output === 'object') {
        if (output.chunks) {
            console.log("Fluency Data (Chunks):", output.chunks);
        }
        return output.text.trim();
      } else if (Array.isArray(output) && output[0] && output[0].text) {
         return output[0].text.trim();
      }
      return "";
    } catch (e) {
      console.error("Transcription error:", e);
      return "[Error during transcription]";
    }
  }
}
