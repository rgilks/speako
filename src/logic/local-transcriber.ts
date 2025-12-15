import { ITranscriber, TranscriptionResult } from './transcriber';
import { AudioRecorder } from './audio';
import { ModelSingleton } from './model-loader';

export {
  subscribeToLoadingState,
  getLoadingState,
  preloadTranscriptionModel,
} from './model-loader';
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
      this.onProgress?.('Loading model...');

      // Track progress across multiple model files to avoid flickering
      const fileProgress: Record<string, number> = {};
      let lastDisplayedProgress = -1;

      this.model = await ModelSingleton.getInstance('Xenova/whisper-base', (data: any) => {
        if (data.status === 'progress' && this.onProgress) {
          const fileName = data.file || 'model';
          fileProgress[fileName] = data.progress || 0;

          // Calculate weighted progress
          const entries = Object.entries(fileProgress);
          let totalWeightedProgress = 0;
          let totalWeight = 0;

          for (const [file, progress] of entries) {
            const isMainModel =
              file.includes('model.onnx') ||
              file.includes('model.safetensors') ||
              file.endsWith('.bin');
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
          this.onProgress?.('Model loaded!');
        }
      });
    }

    // Check if we were cancelled during load
    if (!this.isTranscriptionActive) {
      console.warn('[LocalTranscriber] Start cancelled (stopped during load).');
      return;
    }

    this.onProgress?.('Recording...');
    await this.recorder.start(deviceId);
  }

  async stop(): Promise<TranscriptionResult> {
    this.isTranscriptionActive = false;

    this.onProgress?.('Processing...');
    let audioBlob: Blob;
    try {
      audioBlob = await this.recorder.stop();
    } catch (e) {
      if (e === 'Recorder not started' || (typeof e === 'string' && e.includes('not started'))) {
        console.warn(
          'Stop called but recorder was not started (likely cancelled during model load).'
        );
        return { text: '', words: [] };
      }
      throw e;
    }

    // transformers.js expects a Float32Array or a URL.
    const url = URL.createObjectURL(audioBlob);

    try {
      const output = await this.model(url, {
        return_timestamps: 'word', // Word-level timestamps for accurate word count
        chunk_length_s: 30, // Process audio in 30-second chunks
        stride_length_s: 5, // 5-second overlap between chunks for continuity
        no_speech_threshold: 0.1, // Low threshold to catch accented speech
        language: 'en', // Force English for multilingual model
        task: 'transcribe', // Explicitly set task
      });
      URL.revokeObjectURL(url);

      let text = '';
      let words: any[] = [];

      if (typeof output === 'object') {
        text = output.text?.trim() || '';
        if (output.chunks) {
          console.log(
            '[LocalTranscriber] Chunks structure:',
            JSON.stringify(output.chunks, null, 2)
          );
          // Extract words from chunks
          // With return_timestamps: 'word', transformers.js should return word-level chunks
          // but the structure may vary. Let's handle both cases:
          words = output.chunks
            .flatMap((c: any) => {
              const chunkText = (c.text || '').trim();
              if (!chunkText) return [];

              // Check if this chunk represents a single word or multiple words
              const wordsInText = chunkText.split(/\s+/).filter((w: string) => w.length > 0);

              if (wordsInText.length === 1) {
                // Single word chunk - this is what we want with return_timestamps: 'word'
                return [
                  {
                    word: chunkText,
                    start: c.timestamp?.[0] ?? 0,
                    end: c.timestamp?.[1] ?? 0,
                    score: c.score || 0.99,
                  },
                ];
              } else {
                // Multiple words in one chunk - this shouldn't happen with return_timestamps: 'word'
                // but if it does, we need to split them
                // Note: This is approximate - we don't have word-level timestamps in this case
                const start = c.timestamp?.[0] ?? 0;
                const end = c.timestamp?.[1] ?? 0;
                const duration = end - start;
                const wordDuration = duration / wordsInText.length;

                console.warn(
                  `[LocalTranscriber] Chunk contains ${wordsInText.length} words, ` +
                    `splitting evenly. Word-level timestamps may be inaccurate.`
                );

                return wordsInText.map((word: string, idx: number) => ({
                  word: word.trim(),
                  start: start + wordDuration * idx,
                  end: start + wordDuration * (idx + 1),
                  score: c.score || 0.99,
                }));
              }
            })
            .filter((w: any) => w.word.length > 0);

          console.log(
            `[LocalTranscriber] Extracted ${words.length} words from ${output.chunks.length} chunks`
          );
        }
      } else if (Array.isArray(output) && output[0] && output[0].text) {
        text = output[0].text.trim();
      }

      return { text, words, audioBlob: new Blob([audioBlob], { type: 'audio/webm' }) };
    } catch (e) {
      console.error('Transcription error:', e);
      return {
        text: '[Error during transcription]',
        words: [],
        audioBlob: new Blob([audioBlob], { type: 'audio/webm' }),
      };
    }
  }
}
