import { COMMON_WORDS } from './common-words';

export interface LanguageDetectionResult {
  isLikelyEnglish: boolean;
  confidence: number;
  wordCount: number;
  validWordCount: number;
}

/**
 * Heuristic to check if text is likely English based on common word overlap.
 * @param text The text to analyze
 * @returns Result object with decision and confidence metrics
 */
export function detectEnglish(text: string): LanguageDetectionResult {
  const textWords = text.toLowerCase().match(/\b[a-z']+\b/g) || [];

  if (textWords.length === 0) {
    return {
      isLikelyEnglish: true, // bias towards allowing empty/garbage if no words found
      confidence: 0,
      wordCount: 0,
      validWordCount: 0,
    };
  }

  const validWordCount = textWords.filter((w) => COMMON_WORDS.has(w)).length;
  const confidence = validWordCount / textWords.length;

  // Core English function words that are strong indicators
  const CORE_ENGLISH_WORDS = new Set([
    'the',
    'and',
    'to',
    'of',
    'in',
    'is',
    'it',
    'you',
    'that',
    'he',
    'was',
    'for',
    'on',
    'are',
    'as',
    'with',
    'his',
    'they',
    'i',
    'at',
    'be',
    'this',
    'have',
    'from',
    'or',
    'one',
    'had',
    'by',
    'word',
    'but',
    'not',
  ]);

  const hasCoreWord = textWords.some((w) => CORE_ENGLISH_WORDS.has(w));

  // If we find core function words, we can be more lenient with the remaining vocabulary
  // This helps with "Advanced English" which has many complex words but still uses "the", "of", "to".
  const threshold = hasCoreWord ? 0.15 : 0.5;

  const isLikelyEnglish = confidence > threshold;

  return {
    isLikelyEnglish,
    confidence,
    wordCount: textWords.length,
    validWordCount,
  };
}
