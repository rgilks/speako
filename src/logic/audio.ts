import { calculateAudioLevel } from './audio-analysis';

const ANALYSER_FFT_SIZE = 256;
const ANALYSER_SMOOTHING = 0.3;
const RECORDER_TIMESLICE_MS = 250;
const AUDIO_MIME_TYPE = 'audio/webm';

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private stream: MediaStream | null = null;

  private createAudioConstraints(deviceId?: string): MediaStreamConstraints {
    const constraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    };
    if (deviceId) {
      constraints.deviceId = { exact: deviceId };
    }
    return { audio: constraints };
  }

  private async setupAudioContext(): Promise<void> {
    this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  private setupAnalyser(): void {
    if (!this.audioContext || !this.stream) return;

    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = ANALYSER_FFT_SIZE;
    this.analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
    source.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.fftSize);
  }

  private setupMediaRecorder(): void {
    if (!this.stream) return;

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: AUDIO_MIME_TYPE });
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.onerror = (e) => {
      console.error('[AudioRecorder] MediaRecorder error:', e);
    };

    this.mediaRecorder.onstop = () => {
      if (this.mediaRecorder?.state !== 'inactive') {
        console.warn('[AudioRecorder] Stopped unexpectedly');
      }
    };

    this.mediaRecorder.start(RECORDER_TIMESLICE_MS);
  }

  private cleanupAudioContext(): void {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
    this.dataArray = null;
  }

  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  /**
   * Start recording with optional specific device
   * @param deviceId - Optional device ID from enumerateDevices()
   */
  async start(deviceId?: string): Promise<void> {
    if (this.mediaRecorder?.state === 'recording') {
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(
        this.createAudioConstraints(deviceId)
      );
      await this.setupAudioContext();
      this.setupAnalyser();
      this.setupMediaRecorder();
    } catch (err) {
      this.cleanupStream();
      this.cleanupAudioContext();
      console.error('[AudioRecorder] Error accessing microphone:', err);
      throw err;
    }
  }

  /**
   * Get current audio level (0-1 scale).
   * Returns 0 if not recording.
   */
  getAudioLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;
    return calculateAudioLevel(this.analyser, this.dataArray);
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return reject(new Error('Recorder not started'));
      }

      this.mediaRecorder.onstop = () => {
        const fullBlob = new Blob(this.chunks, { type: AUDIO_MIME_TYPE });
        this.chunks = [];
        this.mediaRecorder = null;
        this.cleanupAudioContext();
        resolve(fullBlob);
      };

      this.mediaRecorder.stop();
      this.cleanupStream();
    });
  }
}
