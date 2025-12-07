export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  
  async start(): Promise<void> {
    console.log("[AudioRecorder] Requesting microphone access...");
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.warn("[AudioRecorder] Already recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          sampleRate: 16000 
        } 
      });
      console.log("[AudioRecorder] Microphone stream acquired.");
      
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          console.log(`[AudioRecorder] Data available: ${e.data.size} bytes`);
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onerror = (e) => {
        console.error("[AudioRecorder] MediaRecorder Error:", e);
      };

      // Warn if it stops unexpectedly (overridden later by stop())
      this.mediaRecorder.onstop = () => {
         console.warn("[AudioRecorder] MediaRecorder stopped unexpectedly (before stop() call). State:", this.mediaRecorder?.state);
      };

      this.mediaRecorder.start();
      console.log("[AudioRecorder] MediaRecorder started.");
    } catch (err) {
      console.error("[AudioRecorder] Error accessing microphone:", err);
      throw err;
    }
  }

  async stop(): Promise<Blob> {
    console.log("[AudioRecorder] Stopping recording...");
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        console.warn("[AudioRecorder] Stop called but recorder not active.");
        return reject("Recorder not started");
      }

      this.mediaRecorder.onstop = () => {
        console.log(`[AudioRecorder] Recorder stopped. Total chunks: ${this.chunks.length}`);
        const fullBlob = new Blob(this.chunks, { type: 'audio/webm' });
        console.log(`[AudioRecorder] Final blob size: ${fullBlob.size} bytes`);
        this.chunks = [];
        this.mediaRecorder = null;
        resolve(fullBlob);
      };

      this.mediaRecorder.stop();
      // Stop all tracks to release mic
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    });
  }
}
