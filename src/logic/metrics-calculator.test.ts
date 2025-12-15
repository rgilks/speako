import { describe, it, expect } from 'vitest';
import { computeMetrics } from './metrics-calculator';

describe('metrics-calculator', () => {
  describe('computeMetrics', () => {
    it('calculates basic word counts correctly', () => {
      const text = 'Hello world from TypeScript';
      const metrics = computeMetrics(text);
      expect(metrics.word_count).toBe(4);
      expect(metrics.character_count).toBe(27);
    });

    it('handles empty input', () => {
      const text = '';
      const metrics = computeMetrics(text);
      expect(metrics.word_count).toBe(0);
      expect(metrics.character_count).toBe(0);
      expect(metrics.cefr_level).toBe('A1');
      expect(metrics.unique_words).toBe(0);
      expect(metrics.complex_words).toBe(0);
    });

    it('handles whitespace only', () => {
      const text = '   \n\t   ';
      const metrics = computeMetrics(text);
      expect(metrics.word_count).toBe(0);
      expect(metrics.character_count).toBe(8);
      expect(metrics.cefr_level).toBe('A1');
    });

    it('handles punctuation correctly', () => {
      const text = 'Hello, world! This is a test.';
      const metrics = computeMetrics(text);
      expect(metrics.word_count).toBe(6);
      expect(metrics.unique_words).toBe(6);
    });

    it('calculates low CEFR (A1/A2) for simple text', () => {
      const text = 'I go to the shop. It is big. I see a cat. The dog is nice.';
      const metrics = computeMetrics(text);
      expect(['A1', 'A2']).toContain(metrics.cefr_level);
    });

    it('calculates high CEFR (B2/C1) for complex text', () => {
      const text =
        'A fundamental understanding of intricate algorithms is absolutely essential for comprehensive software development.';
      const metrics = computeMetrics(text);

      expect(['B2', 'C1', 'C2']).toContain(metrics.cefr_level);
    });

    it('handles noise/punctuation strings', () => {
      const text = '   ...   ';
      const metrics = computeMetrics(text);
      expect(metrics.word_count).toBe(0);
      expect(metrics.unique_words).toBe(0);
      expect(metrics.cefr_level).toBe('A1');
    });

    it('counts unique words correctly (case insensitive)', () => {
      const text = 'Test test TEST';
      const metrics = computeMetrics(text);
      expect(metrics.unique_words).toBe(1);
    });

    it('identifies complex words correctly', () => {
      const text = 'The xylophone is loud';
      const metrics = computeMetrics(text);
      expect(metrics.complex_words).toBe(0);
    });

    it('requires uncommon AND (long OR academic suffix) for complexity', () => {
      const text = 'important university information';
      const metrics = computeMetrics(text);
      expect(metrics.complex_words).toBe(1);
    });

    it('incorporates grammar clarity bonus for high quality text', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const metrics = computeMetrics(text);

      expect(metrics.cefr_level).toBeDefined();
      expect(['A1', 'A2']).toContain(metrics.cefr_level);
    });
  });
});
