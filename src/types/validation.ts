/**
 * Validation types for the ValidatePage component.
 */

export interface ValidationResult {
  fileId: string;
  reference: string;
  hypothesis: string;
  wer: number;
  // CEFR validation
  labeledCEFR: string;
  detectedCEFR: string;
  cefrMatch: boolean;
  // Full pipeline
  wordCount: number;
  clarityScore: number;
  grammarIssues: number;
  processingTimeMs: number;
  // Full data for detail view
  audioBlob?: Blob;
  fullMetrics?: import('../logic/metrics-calculator').Metrics;
  grammarAnalysis?: import('../logic/grammar-checker').AnalysisResult;
  words?: TranscriptionWord[];
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  score: number;
}

export interface STMEntry {
  fileId: string;
  transcript: string;
  labeledCEFR: string;
}

export interface WhisperModel {
  id: string;
  name: string;
  size: number;
}

export const WHISPER_MODELS: WhisperModel[] = [
  { id: 'Xenova/whisper-tiny.en', name: 'Tiny (English) (39MB)', size: 39 },
  { id: 'Xenova/whisper-tiny', name: 'Tiny (Multilingual) (39MB)', size: 39 },
  { id: 'Xenova/whisper-base.en', name: 'Base (English) (74MB)', size: 74 },
  { id: 'Xenova/whisper-base', name: 'Base (Multilingual) (74MB)', size: 74 },
  { id: 'Xenova/whisper-small.en', name: 'Small (English) (241MB)', size: 241 },
  { id: 'onnx-community/distil-small.en', name: 'Distil Small (English) (166MB)', size: 166 },
  { id: 'onnx-community/whisper-large-v3-turbo', name: 'Large v3 Turbo (800MB)', size: 800 },
];
