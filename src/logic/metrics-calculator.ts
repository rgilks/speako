import { COMMON_WORDS } from './common-words';

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

  let complexCount = 0;

  // Normalize and analyze words
  for (const word of textWords) { // Changed from transcript.split to textWords
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!cleanWord) continue;


    if (!COMMON_WORDS.has(cleanWord)) {
      complexCount++;
    }
  }

  // Heuristic for CEFR
  // Based on sentence length and vocabulary complexity
  
  // 1. Average sentence length
  const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 0);
  const validSentenceCount = sentences.length;
  const avgSentenceLen = validSentenceCount > 0
    ? word_count / validSentenceCount
    : 0;

  // 2. Percentage of complex words
  const complexRatio = word_count > 0
    ? complexCount / word_count
    : 0;

  // Score calculation (0-100 scale roughly)
  // Sentence len: >20 is high (C2), <5 is low (A1)
  // Complex ratio: >20% is high (C2), <5% is low (A1)
  
  const sentScore = (Math.min(avgSentenceLen, 25) / 25) * 50; // Max 50 points
  const vocabScore = (Math.min(complexRatio, 0.25) / 0.25) * 50; // Max 50 points
  const totalScore = sentScore + vocabScore;

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
