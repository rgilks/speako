import { COMMON_WORDS } from './common-words';
import { GrammarChecker } from './grammar-checker';

export interface Metrics {
  word_count: number;
  character_count: number;
  unique_words: number;
  complex_words: number;
  cefr_level: string;
  pronunciation_score?: number;
}

/**
 * Compute text metrics for CEFR level estimation.
 * Port of the Rust `compute_metrics` function from speako_core.
 */
export function computeMetrics(text: string, words?: { word: string; score: number }[]): Metrics {
  const textWords = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const word_count = textWords.length;
  const character_count = text.length;

  const unique_words = new Set(textWords).size;

  // Pronunciation Score (Avg Confidence * 100)
  let pronunciation_score = 0;
  if (words && words.length > 0) {
    const totalScore = words.reduce((acc, w) => acc + (w.score || 0), 0);
    pronunciation_score = Math.round((totalScore / words.length) * 100);
  }

  // Heuristic for CEFR (Improved for Spoken Language)
  // Based on sentence length and vocabulary complexity

  // 1. Average sentence length
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const validSentenceCount = sentences.length;
  const avgSentenceLen = validSentenceCount > 0 ? word_count / validSentenceCount : 0;

  // 2. Percentage of complex words
  // Use stricter criteria: word must be genuinely uncommon AND long
  let complexCount = 0;
  for (const word of textWords) {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) continue;

    const isCommon = COMMON_WORDS.has(clean);
    const isLong = clean.length > 9; // Raised from 7 - 9+ chars indicates real complexity
    const hasAcademicSuffix = /((tion)|(ment)|(ence)|(ance)|(ity)|(ive)|(ous)|(ism)|(ist))$/.test(
      clean
    );

    // Only count as complex if BOTH uncommon AND (long OR academic)
    if (!isCommon && (isLong || hasAcademicSuffix)) {
      complexCount++;
    }
  }

  const complexRatio = word_count > 0 ? complexCount / word_count : 0;

  // Score calculation (0-100 scale roughly)
  // Tuned for spoken language from non-native speakers:
  // - Short sentences are normal in speech
  // - Lower vocabulary complexity is expected

  // Sentence length: avg of 12+ words = high complexity for spoken language
  const sentScore = (Math.min(avgSentenceLen, 12) / 12) * 40; // Max 40 points
  // Complex vocabulary: even 10% complex words is high for spoken language
  const vocabScore = (Math.min(complexRatio, 0.1) / 0.1) * 40; // Max 40 points
  let totalScore = sentScore + vocabScore;

  // 3. Grammar Clarity Integration (max 20 points)
  const { clarityScore } = GrammarChecker.check(text);
  totalScore += (clarityScore / 100) * 20; // Up to 20 bonus points for perfect clarity

  // CEFR thresholds adjusted for spoken language
  // Most non-native speakers in B1-B2 range will have scores 30-60
  let cefrLevel: string;
  if (word_count < 10) {
    cefrLevel = 'A1'; // Too short to judge
  } else if (totalScore < 25) {
    cefrLevel = 'A1';
  } else if (totalScore < 40) {
    cefrLevel = 'A2';
  } else if (totalScore < 55) {
    cefrLevel = 'B1';
  } else if (totalScore < 70) {
    cefrLevel = 'B2';
  } else if (totalScore < 85) {
    cefrLevel = 'C1';
  } else {
    cefrLevel = 'C2';
  }

  return {
    word_count,
    character_count,
    cefr_level: cefrLevel,
    unique_words,
    complex_words: complexCount,
    pronunciation_score,
  };
}

// ============================================================================
// ML-BASED CEFR PREDICTION
// ============================================================================

import {
  isCEFRClassifierReady,
  predictCEFR,
  estimateCEFRHeuristic,
  type CEFRPrediction,
} from './cefr-classifier';

export interface MetricsWithConfidence extends Metrics {
  cefr_confidence?: number;
  cefr_method: 'ml' | 'heuristic';
}

/**
 * Compute metrics with ML-based CEFR prediction when classifier is available.
 * Falls back to heuristic when ML model isn't loaded.
 */
export async function computeMetricsWithML(
  text: string,
  words?: { word: string; score: number }[]
): Promise<MetricsWithConfidence> {
  // Get base metrics (word count, pronunciation, etc.)
  const baseMetrics = computeMetrics(text, words);

  // Try ML-based CEFR prediction
  let cefrPrediction: CEFRPrediction;
  let method: 'ml' | 'heuristic' = 'heuristic';

  if (isCEFRClassifierReady()) {
    try {
      cefrPrediction = await predictCEFR(text);
      method = 'ml';
      console.log(
        `[MetricsCalculator] ML CEFR prediction: ${cefrPrediction.level} (${(cefrPrediction.confidence * 100).toFixed(1)}%)`
      );
    } catch (error) {
      console.warn('[MetricsCalculator] ML prediction failed, using heuristic:', error);
      cefrPrediction = estimateCEFRHeuristic(text);
    }
  } else {
    // Use heuristic fallback
    cefrPrediction = estimateCEFRHeuristic(text);
    console.log(`[MetricsCalculator] Using heuristic CEFR: ${cefrPrediction.level}`);
  }

  return {
    ...baseMetrics,
    cefr_level: cefrPrediction.level,
    cefr_confidence: cefrPrediction.confidence,
    cefr_method: method,
  };
}
