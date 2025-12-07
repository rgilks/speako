import { ITranscriber, TranscriptionResult } from './transcriber';
import { AudioRecorder } from './audio';

export class RemoteTranscriber implements ITranscriber {
  private recorder = new AudioRecorder();
  public onProgress?: (msg: string) => void;
  // Use env var if available (for production), otherwise relative path (for local dev proxy or same-domain)
  // For production deployment without custom domain, hardcode the worker URL
  private endpoint = import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/api/transcribe` 
    : "https://speako-worker.rob-gilks.workers.dev/api/transcribe";

  async start(): Promise<void> {
    this.onProgress?.("Connecting to server...");
    // In a real app we might ping the server or check auth here
    await this.recorder.start();
    this.onProgress?.("Recording (Remote)...");
  }

  async stop(): Promise<TranscriptionResult> {
    this.onProgress?.("Uploading...");
    const audioBlob = await this.recorder.stop();
    
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    try {
      this.onProgress?.("Transcribing...");
      const response = await fetch(this.endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      return {
          text: data.transcript || "",
          words: [] // Remote worker doesn't support timestamps yet
      };
    } catch (e: any) {
        console.error("Remote transcription failed:", e);
        throw e;
    }
  }
}
