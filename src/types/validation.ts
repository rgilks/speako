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

export const DEFAULT_WHISPER_MODEL = 'Xenova/whisper-base';
