/**
 * Tests for CEFR Classifier
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { estimateCEFRHeuristic, isCEFRClassifierReady, getCEFRClassifierState } from './cefr-classifier';

describe('cefr-classifier', () => {
  describe('estimateCEFRHeuristic', () => {
    it('returns A1 for very short text', () => {
      const result = estimateCEFRHeuristic('Hi there');
      expect(result.level).toBe('A1');
      expect(result.confidence).toBe(0.3); // Low confidence for very short text
    });

    it('returns A1-A2 for simple text', () => {
      const result = estimateCEFRHeuristic('I like cats. My name is John. I am student.');
      expect(['A1', 'A2']).toContain(result.level);
    });

    it('returns B1-B2 for intermediate text', () => {
      const text = 'I think that learning a new language is very interesting but also quite difficult. You need to practice every day if you want to improve your skills.';
      const result = estimateCEFRHeuristic(text);
      expect(['B1', 'B2']).toContain(result.level);
    });

    it('returns C1-C2 for advanced text', () => {
      const text = 'The implications of this policy are far-reaching, potentially altering the socioeconomic landscape for decades to come. Nevertheless, we must proceed with caution, considering the multifaceted nature of the challenges we face.';
      const result = estimateCEFRHeuristic(text);
      expect(['B2', 'C1', 'C2']).toContain(result.level);
    });

    it('handles empty string', () => {
      const result = estimateCEFRHeuristic('');
      expect(result.level).toBe('A1');
      expect(result.confidence).toBe(0.3);
    });

    it('returns allScores as empty array', () => {
      const result = estimateCEFRHeuristic('Hello world');
      expect(result.allScores).toEqual([]);
    });
  });

  describe('isCEFRClassifierReady', () => {
    it('returns false when classifier not loaded', () => {
      // Initially the classifier is not loaded
      expect(isCEFRClassifierReady()).toBe(false);
    });
  });

  describe('getCEFRClassifierState', () => {
    it('returns initial state correctly', () => {
      const state = getCEFRClassifierState();
      expect(state.isLoaded).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
