/**
 * CEFR Classifier using transformers.js
 * 
 * Loads a fine-tuned MiniLM model for CEFR level prediction.
 * Model runs entirely in the browser via WebGPU/WASM.
 */

import { pipeline, env } from '@huggingface/transformers';

// Configure local caching
env.allowLocalModels = true;
env.useBrowserCache = true;

export interface CEFRPrediction {
  level: string;      // A1, A2, B1, B2, C1, C2
  confidence: number; // 0-1
  allScores: { label: string; score: number }[];
}

// Singleton classifier instance
let classifier: any = null;
let isLoading = false;
let loadError: string | null = null;

// HuggingFace model for CEFR classification
// This is a fine-tuned DistilBERT model trained on CEFR-labeled speech transcripts
const DEFAULT_MODEL = 'robg/speako-cefr';

/**
 * Load the CEFR classifier model.
 * Uses WebGPU if available, falls back to WASM.
 */
export async function loadCEFRClassifier(
  modelId: string = DEFAULT_MODEL,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (classifier) return;
  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }
  
  isLoading = true;
  loadError = null;
  
  try {
    console.log(`[CEFRClassifier] Loading ${modelId}...`);
    
    classifier = await pipeline('text-classification', modelId, {
      device: 'webgpu',
      dtype: 'fp32',
      progress_callback: (data: any) => {
        if (data.status === 'progress' && data.progress && onProgress) {
          onProgress(data.progress);
        }
      }
    });
    
    console.log('[CEFRClassifier] Model loaded successfully!');
  } catch (error) {
    console.error('[CEFRClassifier] Failed to load:', error);
    loadError = String(error);
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * Predict CEFR level for given text.
 * 
 * @param text - The text to classify (typically a transcription)
 * @returns CEFR prediction with confidence scores
 */
export async function predictCEFR(text: string): Promise<CEFRPrediction> {
  if (!classifier) {
    throw new Error('CEFR classifier not loaded. Call loadCEFRClassifier() first.');
  }
  
  // Handle empty/short text
  if (!text || text.trim().length < 5) {
    return {
      level: 'A1',
      confidence: 0,
      allScores: []
    };
  }
  
  try {
    // Get all class probabilities
    const results = await classifier(text, { top_k: 6 });
    
    // Sort by score descending
    const sorted = [...results].sort((a: any, b: any) => b.score - a.score);
    
    return {
      level: sorted[0].label,
      confidence: sorted[0].score,
      allScores: sorted.map((r: any) => ({
        label: r.label,
        score: r.score
      }))
    };
  } catch (error) {
    console.error('[CEFRClassifier] Prediction error:', error);
    throw error;
  }
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
    error: loadError
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
  score += Math.min(uniqueRatio * 40, 30);        // Vocabulary diversity
  score += Math.min((avgWordLength - 3) * 10, 30); // Word complexity
  score += Math.min(wordCount / 5, 30);            // Length bonus
  
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
    allScores: []
  };
}
