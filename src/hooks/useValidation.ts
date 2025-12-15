import { useCallback } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { ModelSingleton } from '../logic/model-loader';
import { computeMetricsWithML } from '../logic/metrics-calculator';
import { GrammarChecker } from '../logic/grammar-checker';
import { loadCEFRClassifier, isCEFRClassifierReady } from '../logic/cefr-classifier';
import { ValidationResult, DEFAULT_WHISPER_MODEL, STMEntry } from '../types/validation';
import { parseSTM, calculateWER, shuffleArray } from '../logic/validation-utils';

// Constants
const DEFAULT_FILE_LIMIT = 10;
const AUDIO_SAMPLE_RATE = 16000;
const AUDIO_CHANNELS = 1;
const MODEL_CONFIG = {
  language: 'english',
  return_timestamps: 'word' as const,
  chunk_length_s: 30,
};
const DEFAULT_WORD_SCORE = 0.95;
const DATA_PATHS = {
  STM: '/test-data/reference-materials/stms/dev-asr.stm',
  TSV: '/test-data/reference-materials/flists.flac/dev-asr.tsv',
  AUDIO_BASE: '/test-data/data/flac/dev',
} as const;

interface ModelProgressData {
  status?: string;
  progress?: number;
}

interface WhisperOutput {
  text?: string;
  chunks?: Array<{
    text: string;
    timestamp?: [number, number];
  }>;
}

type WhisperModel = (
  audioData: Float32Array,
  config: typeof MODEL_CONFIG
) => Promise<WhisperOutput>;

async function loadModelAndClassifier(
  modelId: string,
  onProgress: (msg: string) => void
): Promise<WhisperModel> {
  onProgress(`Loading ${modelId}...`);
  const model = await ModelSingleton.getInstance(modelId, (data: ModelProgressData) => {
    if (data.status === 'progress' && data.progress) {
      onProgress(`Loading Whisper... ${Math.round(data.progress)}%`);
    }
  });

  if (!isCEFRClassifierReady()) {
    onProgress('Loading CEFR classifier...');
    try {
      await loadCEFRClassifier();
    } catch (e) {
      console.warn('[Validation] CEFR classifier not available:', e);
    }
  }

  return model as WhisperModel;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }
  return response.text();
}

function parseFileList(tsvText: string): Array<{ fileId: string; path: string }> {
  return tsvText
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const [fileId, path] = l.split('\t');
      return { fileId, path };
    });
}

async function loadReferences(): Promise<{
  references: Map<string, STMEntry>;
  files: Array<{ fileId: string; path: string }>;
}> {
  const [stmText, tsvText] = await Promise.all([
    fetchText(DATA_PATHS.STM),
    fetchText(DATA_PATHS.TSV),
  ]);

  const references = parseSTM(stmText);
  const allFiles = parseFileList(tsvText);
  shuffleArray(allFiles);

  return { references, files: allFiles };
}

async function decodeAudio(audioBlob: Blob): Promise<Float32Array> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new OfflineAudioContext(AUDIO_CHANNELS, 1, AUDIO_SAMPLE_RATE);
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0);
}

function mapWhisperWords(chunks: WhisperOutput['chunks'] = []) {
  return chunks.map((c) => ({
    word: c.text,
    start: c.timestamp?.[0] ?? 0,
    end: c.timestamp?.[1] ?? 0,
    score: DEFAULT_WORD_SCORE,
  }));
}

function checkCEFRMatch(detected: string, labeled: string): boolean {
  return detected.startsWith(labeled) || labeled.startsWith(detected);
}

async function processAudioFile(
  fileId: string,
  audioUrl: string,
  model: WhisperModel,
  reference: STMEntry
): Promise<ValidationResult | null> {
  const startTime = performance.now();

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) return null;

  const audioBlob = await audioRes.blob();
  const monoData = await decodeAudio(audioBlob);
  const output = await model(monoData, MODEL_CONFIG);

  const hypothesis = output.text || '';
  const words = mapWhisperWords(output.chunks);

  const [metrics, grammarAnalysis] = await Promise.all([
    computeMetricsWithML(hypothesis),
    Promise.resolve(GrammarChecker.check(hypothesis)),
  ]);

  const wer = calculateWER(reference.transcript, hypothesis);
  const endTime = performance.now();

  return {
    fileId,
    reference: reference.transcript,
    hypothesis,
    wer,
    labeledCEFR: reference.labeledCEFR,
    detectedCEFR: metrics.cefr_level,
    cefrMatch: checkCEFRMatch(metrics.cefr_level, reference.labeledCEFR),
    wordCount: metrics.word_count,
    clarityScore: metrics.pronunciation_score || 0,
    grammarIssues: grammarAnalysis.issues.length,
    processingTimeMs: Math.round(endTime - startTime),
    audioBlob,
    fullMetrics: metrics,
    grammarAnalysis,
    words,
  };
}

function calculateAverages(results: ValidationResult[]) {
  if (results.length === 0) return { avgWER: 0, cefrAccuracy: 0, avgClarity: 0 };

  return {
    avgWER: results.reduce((s, r) => s + r.wer, 0) / results.length,
    cefrAccuracy: results.filter((r) => r.cefrMatch).length / results.length,
    avgClarity: results.reduce((s, r) => s + r.clarityScore, 0) / results.length,
  };
}

export function useValidation() {
  const status = useSignal('Ready');
  const progress = useSignal(0);
  const totalFiles = useSignal(0);
  const results = useSignal<ValidationResult[]>([]);
  const isRunning = useSignal(false);
  const isComplete = useSignal(false);
  const fileLimit = useSignal(DEFAULT_FILE_LIMIT);
  const avgWER = useSignal(0);
  const cefrAccuracy = useSignal(0);
  const avgClarity = useSignal(0);

  const runValidation = useCallback(async () => {
    isRunning.value = true;
    results.value = [];

    try {
      const model = await loadModelAndClassifier(DEFAULT_WHISPER_MODEL, (msg) => {
        status.value = msg;
      });

      status.value = 'Loading references...';
      const { references, files } = await loadReferences();
      const filesToProcess = files.slice(0, fileLimit.value);
      totalFiles.value = filesToProcess.length;

      const validationResults: ValidationResult[] = [];

      for (let i = 0; i < filesToProcess.length; i++) {
        const { fileId } = filesToProcess[i];
        const ref = references.get(fileId);
        if (!ref) continue;

        progress.value = i + 1;
        status.value = `[${i + 1}/${filesToProcess.length}] ${fileId}`;

        try {
          const result = await processAudioFile(
            fileId,
            `${DATA_PATHS.AUDIO_BASE}/${fileId}.flac`,
            model,
            ref
          );

          if (result) {
            validationResults.push(result);
            results.value = [...validationResults];
          }
        } catch (err) {
          console.error(`Error processing ${fileId}:`, err);
        }
      }

      const averages = calculateAverages(validationResults);
      avgWER.value = averages.avgWER;
      cefrAccuracy.value = averages.cefrAccuracy;
      avgClarity.value = averages.avgClarity;

      isComplete.value = true;
      status.value = 'Validation complete!';
    } catch (err) {
      status.value = `Error: ${err}`;
      console.error(err);
    } finally {
      isRunning.value = false;
    }
    // Signals are stable references and don't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileLimit]);

  return {
    status,
    progress,
    totalFiles,
    results,
    isRunning,
    isComplete,
    fileLimit,
    avgWER,
    cefrAccuracy,
    avgClarity,
    runValidation,
  };
}
