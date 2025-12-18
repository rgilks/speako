import { ITranscriber, TranscriptionResult, TranscriptionWord } from './transcriber';
import { AudioRecorder } from './audio';
import { ModelSingleton } from './model-loader';

export {
  subscribeToLoadingState,
  getLoadingState,
  preloadTranscriptionModel,
} from './model-loader';
export type { ModelLoadingState } from './model-loader';

const MODEL_ID = 'Xenova/whisper-base';
const MAIN_MODEL_WEIGHT = 100;
const OTHER_FILE_WEIGHT = 1;
const DEFAULT_WORD_SCORE = 0.99;

const TRANSCRIPTION_CONFIG = {
  return_timestamps: 'word' as const,
  chunk_length_s: 30,
  stride_length_s: 5,
  no_speech_threshold: 0.1,
  task: 'transcribe' as const,
} as const;

interface ModelProgressData {
  status: 'progress' | 'ready';
  file?: string;
  progress?: number;
}

interface WhisperChunk {
  text?: string;
  timestamp?: [number, number];
  score?: number;
}

interface WhisperOutput {
  text?: string;
  chunks?: WhisperChunk[];
}

function isMainModelFile(fileName: string): boolean {
  return (
    fileName.includes('model.onnx') ||
    fileName.includes('model.safetensors') ||
    fileName.endsWith('.bin')
  );
}

function calculateWeightedProgress(fileProgress: Record<string, number>): number {
  let totalWeightedProgress = 0;
  let totalWeight = 0;

  for (const [file, progress] of Object.entries(fileProgress)) {
    const weight = isMainModelFile(file) ? MAIN_MODEL_WEIGHT : OTHER_FILE_WEIGHT;
    totalWeightedProgress += progress * weight;
    totalWeight += weight;
  }

  return Math.round(totalWeightedProgress / Math.max(totalWeight, 1));
}

function extractWordsFromChunks(chunks: WhisperChunk[]): TranscriptionWord[] {
  return chunks
    .flatMap((c) => {
      const chunkText = (c.text || '').trim();
      if (!chunkText) return [];

      const wordsInText = chunkText.split(/\s+/).filter((w) => w.length > 0);

      if (wordsInText.length === 1) {
        return [
          {
            word: chunkText,
            start: c.timestamp?.[0] ?? 0,
            end: c.timestamp?.[1] ?? 0,
            score: c.score || DEFAULT_WORD_SCORE,
          },
        ];
      }

      const start = c.timestamp?.[0] ?? 0;
      const end = c.timestamp?.[1] ?? 0;
      const duration = end - start;
      const wordDuration = duration / wordsInText.length;

      console.warn(
        `[LocalTranscriber] Chunk contains ${wordsInText.length} words, ` +
          'splitting evenly. Word-level timestamps may be inaccurate.'
      );

      return wordsInText.map((word, idx) => ({
        word: word.trim(),
        start: start + wordDuration * idx,
        end: start + wordDuration * (idx + 1),
        score: c.score || DEFAULT_WORD_SCORE,
      }));
    })
    .filter((w) => w.word.length > 0);
}

export class LocalTranscriber implements ITranscriber {
  private recorder = new AudioRecorder();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any = null;
  public onProgress?: (msg: string) => void;
  private isTranscriptionActive = false;

  /**
   * Get the audio recorder instance for level monitoring
   */
  getRecorder(): AudioRecorder {
    return this.recorder;
  }

  async start(deviceId?: string): Promise<void> {
    this.isTranscriptionActive = true;

    if (!this.model) {
      this.onProgress?.('Loading model...');

      const fileProgress: Record<string, number> = {};
      let lastDisplayedProgress = -1;

      this.model = await ModelSingleton.getInstance(MODEL_ID, (data: ModelProgressData) => {
        if (data.status === 'progress' && this.onProgress) {
          const fileName = data.file || 'model';
          fileProgress[fileName] = data.progress || 0;

          const overallProgress = calculateWeightedProgress(fileProgress);

          if (overallProgress !== lastDisplayedProgress) {
            lastDisplayedProgress = overallProgress;
            this.onProgress(`Downloading model... ${overallProgress}%`);
          }
        } else if (data.status === 'ready') {
          this.onProgress?.('Model loaded!');
        }
      });
    }

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
      const errorMsg = typeof e === 'string' ? e : String(e);
      if (errorMsg.includes('not started')) {
        console.warn('[LocalTranscriber] Stop called but recorder was not started.');
        return { text: '', words: [] };
      }
      throw e;
    }

    const url = URL.createObjectURL(audioBlob);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output: WhisperOutput | any = await this.model(url, TRANSCRIPTION_CONFIG);
      URL.revokeObjectURL(url);

      let text = '';
      let words: TranscriptionWord[] = [];

      if (typeof output === 'object' && output !== null) {
        text = output.text?.trim() || '';
        if (output.chunks && Array.isArray(output.chunks)) {
          words = extractWordsFromChunks(output.chunks);
          console.log(
            `[LocalTranscriber] Extracted ${words.length} words from ${output.chunks.length} chunks`
          );
        }
      } else if (Array.isArray(output) && output[0]?.text) {
        text = output[0].text.trim();
      }

      return { text, words, audioBlob: new Blob([audioBlob], { type: 'audio/webm' }) };
    } catch (e) {
      console.error('[LocalTranscriber] Transcription error:', e);
      return {
        text: '[Error during transcription]',
        words: [],
        audioBlob: new Blob([audioBlob], { type: 'audio/webm' }),
      };
    }
  }
}
