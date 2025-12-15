import { TranscriptionWord } from '../logic/transcriber';

export interface ValidationResult {
  fileId: string;
  reference: string;
  hypothesis: string;
  wer: number;
  labeledCEFR: string;
  detectedCEFR: string;
  cefrMatch: boolean;
  wordCount: number;
  clarityScore: number;
  grammarIssues: number;
  processingTimeMs: number;
  audioBlob?: Blob;
  fullMetrics?: import('../logic/metrics-calculator').Metrics;
  grammarAnalysis?: import('../logic/grammar-checker').AnalysisResult;
  words?: TranscriptionWord[];
}

export interface STMEntry {
  fileId: string;
  transcript: string;
  labeledCEFR: string;
}

export const DEFAULT_WHISPER_MODEL = 'Xenova/whisper-base';
