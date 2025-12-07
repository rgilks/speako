export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  
  async start(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          sampleRate: 16000 
        } 
      });
      
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.start();
    } catch (err) {
      console.error("Error accessing microphone:", err);
      throw err;
    }
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return reject("Recorder not started");
      }

      this.mediaRecorder.onstop = () => {
        const fullBlob = new Blob(this.chunks, { type: 'audio/webm' });
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
