import { COMMON_WORDS } from './common-words';
import { GrammarChecker } from './grammar-checker';
import {
  isCEFRClassifierReady,
  predictCEFR,
  estimateCEFRHeuristic,
  type CEFRPrediction,
} from './cefr-classifier';

export interface Metrics {
  word_count: number;
  character_count: number;
  unique_words: number;
  complex_words: number;
  cefr_level: string;
  pronunciation_score?: number;
}

const MIN_WORD_LENGTH_FOR_COMPLEXITY = 9;
const ACADEMIC_SUFFIX_PATTERN = /((tion)|(ment)|(ence)|(ance)|(ity)|(ive)|(ous)|(ism)|(ist))$/;
const MIN_WORDS_FOR_CEFR = 10;
const MAX_SENTENCE_LENGTH_SCORE = 12;
const SENTENCE_SCORE_WEIGHT = 40;
const VOCAB_SCORE_WEIGHT = 40;
const MAX_COMPLEX_RATIO = 0.1;
const GRAMMAR_SCORE_WEIGHT = 20;
const PRONUNCIATION_SCALE = 100;

const CEFR_THRESHOLDS = {
  A1: 25,
  A2: 40,
  B1: 55,
  B2: 70,
  C1: 85,
} as const;

function calculatePronunciationScore(words?: { word: string; score: number }[]): number {
  if (!words || words.length === 0) return 0;
  const totalScore = words.reduce((acc, w) => acc + (w.score || 0), 0);
  return Math.round((totalScore / words.length) * PRONUNCIATION_SCALE);
}

function isComplexWord(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return false;

  const isCommon = COMMON_WORDS.has(clean);
  const isLong = clean.length > MIN_WORD_LENGTH_FOR_COMPLEXITY;
  const hasAcademicSuffix = ACADEMIC_SUFFIX_PATTERN.test(clean);

  return !isCommon && (isLong || hasAcademicSuffix);
}

function countComplexWords(textWords: string[]): number {
  return textWords.filter(isComplexWord).length;
}

function calculateCEFRScore(
  avgSentenceLen: number,
  complexRatio: number,
  clarityScore: number
): number {
  const sentScore =
    (Math.min(avgSentenceLen, MAX_SENTENCE_LENGTH_SCORE) / MAX_SENTENCE_LENGTH_SCORE) *
    SENTENCE_SCORE_WEIGHT;
  const vocabScore =
    (Math.min(complexRatio, MAX_COMPLEX_RATIO) / MAX_COMPLEX_RATIO) * VOCAB_SCORE_WEIGHT;
  const grammarScore = (clarityScore / 100) * GRAMMAR_SCORE_WEIGHT;
  return sentScore + vocabScore + grammarScore;
}

function determineCEFRLevel(wordCount: number, totalScore: number): string {
  if (wordCount < MIN_WORDS_FOR_CEFR) return 'A1';
  if (totalScore < CEFR_THRESHOLDS.A1) return 'A1';
  if (totalScore < CEFR_THRESHOLDS.A2) return 'A2';
  if (totalScore < CEFR_THRESHOLDS.B1) return 'B1';
  if (totalScore < CEFR_THRESHOLDS.B2) return 'B2';
  if (totalScore < CEFR_THRESHOLDS.C1) return 'C1';
  return 'C2';
}

export function computeMetrics(text: string, words?: { word: string; score: number }[]): Metrics {
  const textWords = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
  const word_count = textWords.length;
  const character_count = text.length;
  const unique_words = new Set(textWords).size;
  const pronunciation_score = calculatePronunciationScore(words);

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLen = sentences.length > 0 ? word_count / sentences.length : 0;

  const complexCount = countComplexWords(textWords);
  const complexRatio = word_count > 0 ? complexCount / word_count : 0;

  const { clarityScore } = GrammarChecker.check(text);
  const totalScore = calculateCEFRScore(avgSentenceLen, complexRatio, clarityScore);
  const cefrLevel = determineCEFRLevel(word_count, totalScore);

  return {
    word_count,
    character_count,
    cefr_level: cefrLevel,
    unique_words,
    complex_words: complexCount,
    pronunciation_score,
  };
}

export interface MetricsWithConfidence extends Metrics {
  cefr_confidence?: number;
  cefr_method: 'ml' | 'heuristic';
}

async function getCEFRPrediction(
  text: string
): Promise<{ prediction: CEFRPrediction; method: 'ml' | 'heuristic' }> {
  if (isCEFRClassifierReady()) {
    try {
      const prediction = await predictCEFR(text);
      console.log(
        `[MetricsCalculator] ML CEFR prediction: ${prediction.level} (${(prediction.confidence * 100).toFixed(1)}%)`
      );
      return { prediction, method: 'ml' };
    } catch (error) {
      console.warn('[MetricsCalculator] ML prediction failed, using heuristic:', error);
      return { prediction: estimateCEFRHeuristic(text), method: 'heuristic' };
    }
  }
  const prediction = estimateCEFRHeuristic(text);
  console.log(`[MetricsCalculator] Using heuristic CEFR: ${prediction.level}`);
  return { prediction, method: 'heuristic' };
}

export async function computeMetricsWithML(
  text: string,
  words?: { word: string; score: number }[]
): Promise<MetricsWithConfidence> {
  const baseMetrics = computeMetrics(text, words);
  const { prediction, method } = await getCEFRPrediction(text);

  return {
    ...baseMetrics,
    cefr_level: prediction.level,
    cefr_confidence: prediction.confidence,
    cefr_method: method,
  };
}
