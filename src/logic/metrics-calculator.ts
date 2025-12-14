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
export function computeMetrics(text: string, words?: { word: string, score: number }[]): Metrics {
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
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const validSentenceCount = sentences.length;
  const avgSentenceLen = validSentenceCount > 0
    ? word_count / validSentenceCount
    : 0;

  // 2. Percentage of complex words
  // Bonus: If word is long (>7 chars) or has academic suffix, count as complex even if "common"
  let complexCount = 0;
  for (const word of textWords) {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      if (!clean) continue;
      
      const isCommon = COMMON_WORDS.has(clean);
      const isLong = clean.length > 7;
      const hasAcademicSuffix = /((tion)|(ment)|(ence)|(ance)|(ity)|(ive)|(ous)|(ism)|(ist))$/.test(clean);
      
      if (!isCommon || isLong || hasAcademicSuffix) {
          complexCount++;
      }
  }

  const complexRatio = word_count > 0
    ? complexCount / word_count
    : 0;

  // Score calculation (0-100 scale roughly)
  // Tuned for speech:
  // Sentence len: >15 is high (C2), was 25
  // Complex ratio: >18% is high (C2), was 25%
  
  const sentScore = (Math.min(avgSentenceLen, 15) / 15) * 50; // Max 50 points
  const vocabScore = (Math.min(complexRatio, 0.18) / 0.18) * 50; // Max 50 points
  let totalScore = sentScore + vocabScore;

  // 3. Grammar Clarity Integration
  const { clarityScore } = GrammarChecker.check(text);
  if (clarityScore > 80) {
      totalScore += 5; // Bonus for high clarity
  } else if (clarityScore < 40) {
      totalScore -= 5; // Penalty for poor clarity
  }
  
  let cefrLevel: string;
  if (word_count < 10) {
    cefrLevel = "A1"; // Too short to judge
  } else if (totalScore < 20) {
    cefrLevel = "A1";
  } else if (totalScore < 40) {
    cefrLevel = "A2";
  } else if (totalScore < 60) {
    cefrLevel = "B1";
  } else if (totalScore < 80) {
    cefrLevel = "B2";
  } else if (totalScore < 90) {
    cefrLevel = "C1";
  } else {
    cefrLevel = "C2";
  }

  return {
    word_count,
    character_count,
    cefr_level: cefrLevel,
    unique_words,
    complex_words: complexCount,
    pronunciation_score
  };
}
