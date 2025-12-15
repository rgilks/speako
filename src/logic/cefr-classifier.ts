/**
 * CEFR Classifier using transformers.js
 * Loads a fine-tuned DeBERTa model for CEFR level prediction.
 * Model runs entirely in the browser via WebGPU/WASM.
 */

import { pipeline, env } from '@huggingface/transformers';
import { checkWebGPU } from './webgpu-check';

env.allowLocalModels = false;
env.useBrowserCache = true;

export interface CEFRPrediction {
  level: string;
  confidence: number;
  allScores: { label: string; score: number }[];
}

const DEFAULT_MODEL = 'robg/speako-cefr-deberta';
const PREDICTION_TOP_K = 6;
const PREDICTION_MAX_LENGTH = 256;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let classifier: any = null;
let isLoading = false;
let loadError: string | null = null;

export async function loadCEFRClassifier(): Promise<void> {
  if (classifier || isLoading) return;

  try {
    isLoading = true;
    loadError = null;

    const webGpuStatus = await checkWebGPU();
    let device: 'webgpu' | 'wasm' = webGpuStatus.isAvailable ? 'webgpu' : 'wasm';

    console.log(
      `Loading CEFR Classifier with ${device.toUpperCase()}${device === 'wasm' ? ' (WebGPU unavailable)' : ''}...`
    );

    const loadWithDevice = async (selectedDevice: 'webgpu' | 'wasm') => {
      return await pipeline('text-classification', DEFAULT_MODEL, {
        device: selectedDevice,
      });
    };

    try {
      classifier = await loadWithDevice(device);
    } catch (webgpuError) {
      if (device === 'webgpu') {
        console.warn('WebGPU failed for CEFR classifier, falling back to WASM:', webgpuError);
        device = 'wasm';
        classifier = await loadWithDevice('wasm');
      } else {
        throw webgpuError;
      }
    }

    console.log(`CEFR Classifier loaded successfully with ${device.toUpperCase()}`);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Failed to load CEFR classifier:', error);
    loadError = error.message;
    throw error;
  } finally {
    isLoading = false;
  }
}

export async function predictCEFR(text: string): Promise<CEFRPrediction> {
  if (!classifier) {
    throw new Error('CEFR Classifier not loaded');
  }

  const results = await classifier(text, {
    top_k: PREDICTION_TOP_K,
    truncation: true,
    max_length: PREDICTION_MAX_LENGTH,
    padding: true,
  });

  return {
    level: results[0].label,
    confidence: results[0].score,
    allScores: results,
  };
}

export function isCEFRClassifierReady(): boolean {
  return classifier !== null;
}

export function getCEFRClassifierState(): {
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
} {
  return {
    isLoading,
    isLoaded: classifier !== null,
    error: loadError,
  };
}

const HEURISTIC_MIN_WORDS = 10;
const HEURISTIC_DIVERSITY_MULTIPLIER = 40;
const HEURISTIC_DIVERSITY_MAX = 30;
const HEURISTIC_LENGTH_BASE = 3;
const HEURISTIC_LENGTH_MULTIPLIER = 10;
const HEURISTIC_LENGTH_MAX = 30;
const HEURISTIC_WORD_COUNT_DIVISOR = 5;
const HEURISTIC_WORD_COUNT_MAX = 30;
const HEURISTIC_CONFIDENCE = 0.5;

const CEFR_THRESHOLDS = {
  A1: 25,
  A2: 40,
  B1: 55,
  B2: 70,
  C1: 85,
} as const;

export function estimateCEFRHeuristic(text: string): CEFRPrediction {
  const words = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const wordCount = words.length;

  if (wordCount < HEURISTIC_MIN_WORDS) {
    return { level: 'A1', confidence: 0.3, allScores: [] };
  }

  const uniqueWords = new Set(words).size;
  const uniqueRatio = uniqueWords / wordCount;
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / wordCount;

  let score = 0;
  score += Math.min(uniqueRatio * HEURISTIC_DIVERSITY_MULTIPLIER, HEURISTIC_DIVERSITY_MAX);
  score += Math.min(
    (avgWordLength - HEURISTIC_LENGTH_BASE) * HEURISTIC_LENGTH_MULTIPLIER,
    HEURISTIC_LENGTH_MAX
  );
  score += Math.min(wordCount / HEURISTIC_WORD_COUNT_DIVISOR, HEURISTIC_WORD_COUNT_MAX);

  let level: string;
  if (score < CEFR_THRESHOLDS.A1) level = 'A1';
  else if (score < CEFR_THRESHOLDS.A2) level = 'A2';
  else if (score < CEFR_THRESHOLDS.B1) level = 'B1';
  else if (score < CEFR_THRESHOLDS.B2) level = 'B2';
  else if (score < CEFR_THRESHOLDS.C1) level = 'C1';
  else level = 'C2';

  return {
    level,
    confidence: HEURISTIC_CONFIDENCE,
    allScores: [],
  };
}
