import { COMMON_WORDS } from './common-words';

export interface Metrics {
  word_count: number;
  character_count: number;
  cefr_level: string;
  unique_words: number;
  complex_words: number;
}

/**
 * Compute text metrics for CEFR level estimation.
 * Port of the Rust `compute_metrics` function from speako_core.
 */
export function computeMetrics(transcript: string): Metrics {
  const wordCount = transcript.split(/\s+/).filter(w => w.length > 0).length;
  const characterCount = transcript.length;

  const uniqueSet = new Set<string>();
  let complexCount = 0;

  // Normalize and analyze words
  for (const word of transcript.split(/\s+/)) {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!cleanWord) continue;

    uniqueSet.add(cleanWord);
    if (!COMMON_WORDS.has(cleanWord)) {
      complexCount++;
    }
  }

  // Heuristic for CEFR
  // Based on sentence length and vocabulary complexity
  
  // 1. Average sentence length
  const sentences = transcript.split(/[.!?]/).filter(s => s.trim().length > 0);
  const validSentenceCount = sentences.length;
  const avgSentenceLen = validSentenceCount > 0
    ? wordCount / validSentenceCount
    : 0;

  // 2. Percentage of complex words
  const complexRatio = wordCount > 0
    ? complexCount / wordCount
    : 0;

  // Score calculation (0-100 scale roughly)
  // Sentence len: >20 is high (C2), <5 is low (A1)
  // Complex ratio: >20% is high (C2), <5% is low (A1)
  
  const sentScore = (Math.min(avgSentenceLen, 25) / 25) * 50; // Max 50 points
  const vocabScore = (Math.min(complexRatio, 0.25) / 0.25) * 50; // Max 50 points
  const totalScore = sentScore + vocabScore;

  let cefrLevel: string;
  if (wordCount < 10) {
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
    word_count: wordCount,
    character_count: characterCount,
    cefr_level: cefrLevel,
    unique_words: uniqueSet.size,
    complex_words: complexCount,
  };
}
