export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  
  // Web Audio API for level monitoring
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private stream: MediaStream | null = null;
  
  /**
   * Start recording with optional specific device
   * @param deviceId - Optional device ID from enumerateDevices()
   */
  async start(deviceId?: string): Promise<void> {
    console.log("[AudioRecorder] Requesting microphone access...", deviceId ? `deviceId: ${deviceId}` : "(default)");
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.warn("[AudioRecorder] Already recording.");
      return;
    }

    try {
      // Build audio constraints
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };
      
      // If specific device requested, add deviceId constraint
      if (deviceId) {
        audioConstraints.deviceId = { exact: deviceId };
      }
      
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints
      });
      console.log("[AudioRecorder] Microphone stream acquired.");
      
      // Debug: Log stream details
      const tracks = this.stream.getAudioTracks();
      console.log("[AudioRecorder] Audio tracks:", tracks.length);
      tracks.forEach((track, i) => {
        console.log(`[AudioRecorder] Track ${i}: label="${track.label}", enabled=${track.enabled}, readyState=${track.readyState}, muted=${track.muted}`);
        const settings = track.getSettings();
        console.log(`[AudioRecorder] Track ${i} settings:`, settings);
      });
      
      // Set up Web Audio API for level monitoring
      this.audioContext = new AudioContext();
      console.log("[AudioRecorder] AudioContext created. State:", this.audioContext.state, "sampleRate:", this.audioContext.sampleRate);
      
      // Resume AudioContext if suspended (required after user interaction in some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log("[AudioRecorder] AudioContext resumed from suspended state.");
      }
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.3; // Lower = more responsive
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.fftSize);
      console.log("[AudioRecorder] Audio analyser initialized. FFT size:", this.analyser.fftSize);
      
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm' });
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

      // Start with 250ms timeslice to capture data periodically during recording
      // Without this, ondataavailable only fires once on stop() with minimal data
      this.mediaRecorder.start(250);
      console.log("[AudioRecorder] MediaRecorder started with 250ms timeslice.");
    } catch (err) {
      console.error("[AudioRecorder] Error accessing microphone:", err);
      throw err;
    }
  }
  
  /**
   * Get current audio level (0-1 scale).
   * Returns 0 if not recording.
   */
  getAudioLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;
    
    // Use time domain data (waveform) for more reliable level detection
    this.analyser.getByteTimeDomainData(this.dataArray);
    
    // Calculate peak level from waveform (values centered around 128)
    let peak = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const amplitude = Math.abs(this.dataArray[i] - 128);
      if (amplitude > peak) {
        peak = amplitude;
      }
    }
    
    // Normalize to 0-1 (max deviation from center is 128)
    const level = peak / 128;
    
    return level;
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
        
        // Clean up Web Audio API
        if (this.audioContext) {
          this.audioContext.close().catch(() => {});
          this.audioContext = null;
        }
        this.analyser = null;
        this.dataArray = null;
        
        resolve(fullBlob);
      };

      this.mediaRecorder.stop();
      // Stop all tracks to release mic
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
    });
  }
}
