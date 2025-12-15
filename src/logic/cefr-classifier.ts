/**
 * CEFR Classifier using transformers.js
 *
 * Loads a fine-tuned MiniLM model for CEFR level prediction.
 * Model runs entirely in the browser via WebGPU/WASM.
 */

import { pipeline, env } from '@huggingface/transformers';
import { checkWebGPU } from './webgpu-check';

// Configure caching
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface CEFRPrediction {
  level: string; // A1, A2, B1, B2, C1, C2
  confidence: number; // 0-1
  allScores: { label: string; score: number }[];
}

// Singleton classifier instance
let classifier: any = null;
let isLoading = false;
let loadError: string | null = null;

// HuggingFace model for CEFR classification
// Fine-tuned DeBERTa-v3 trained on CEFR-labeled speech transcripts with Noise Augmentation
const DEFAULT_MODEL = 'robg/speako-cefr-deberta';

/**
 * Load the CEFR classification model.
 */
export async function loadCEFRClassifier(): Promise<void> {
  if (classifier || isLoading) return;

  try {
    isLoading = true;
    loadError = null;

    // Check WebGPU availability and determine device
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
      // If WebGPU was attempted and failed, try WASM fallback
      if (device === 'webgpu') {
        console.warn(`WebGPU failed for CEFR classifier, falling back to WASM:`, webgpuError);
        device = 'wasm';
        classifier = await loadWithDevice('wasm');
      } else {
        throw webgpuError;
      }
    }

    console.log(`CEFR Classifier loaded successfully with ${device.toUpperCase()}`);
  } catch (err: any) {
    console.error('Failed to load CEFR classifier:', err);
    loadError = err.message || String(err);
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Predict CEFR level for a given text.
 */
export async function predictCEFR(text: string): Promise<CEFRPrediction> {
  if (!classifier) {
    throw new Error('CEFR Classifier not loaded');
  }

  // Get all class probabilities with explicit truncation
  const results = await classifier(text, {
    top_k: 6,
    truncation: true,
    max_length: 256,
    padding: true,
  });

  // DeBERTa-v3 with Noise Augmentation is robust enough to trust directly.
  // No heuristics, no ensembles, no hacks.
  // "Train Hard, Fight Easy."

  return {
    level: results[0].label,
    confidence: results[0].score,
    allScores: results,
  };
}

/**
 * Check if classifier is loaded and ready.
 */
export function isCEFRClassifierReady(): boolean {
  return classifier !== null;
}

/**
 * Get current loading state.
 */
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

/**
 * Fallback heuristic CEFR estimation (used when model not available).
 * This is a simplified version of the metrics-calculator logic.
 */
export function estimateCEFRHeuristic(text: string): CEFRPrediction {
  const words = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const wordCount = words.length;

  if (wordCount < 10) {
    return { level: 'A1', confidence: 0.3, allScores: [] };
  }

  const uniqueWords = new Set(words).size;
  const uniqueRatio = uniqueWords / wordCount;
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / wordCount;

  // Simple heuristic score
  let score = 0;
  score += Math.min(uniqueRatio * 40, 30); // Vocabulary diversity
  score += Math.min((avgWordLength - 3) * 10, 30); // Word complexity
  score += Math.min(wordCount / 5, 30); // Length bonus

  let level: string;
  if (score < 25) level = 'A1';
  else if (score < 40) level = 'A2';
  else if (score < 55) level = 'B1';
  else if (score < 70) level = 'B2';
  else if (score < 85) level = 'C1';
  else level = 'C2';

  return {
    level,
    confidence: 0.5, // Low confidence for heuristic
    allScores: [],
  };
}
