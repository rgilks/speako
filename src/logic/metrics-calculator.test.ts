import { describe, it, expect } from 'vitest';
import { computeMetrics } from './metrics-calculator';

describe('metrics-calculator', () => {
  describe('computeMetrics', () => {
    it('calculates basic word counts correctly', () => {
      const text = "Hello world from TypeScript";
      const metrics = computeMetrics(text);
      expect(metrics.word_count).toBe(4);
      expect(metrics.character_count).toBe(27);
    });

    it('handles empty input', () => {
      const text = "";
      const metrics = computeMetrics(text);
      expect(metrics.word_count).toBe(0);
      expect(metrics.character_count).toBe(0);
      expect(metrics.cefr_level).toBe("A1");
      expect(metrics.unique_words).toBe(0);
      expect(metrics.complex_words).toBe(0);
    });

    it('handles whitespace only', () => {
      const text = "   \n\t   ";
      const metrics = computeMetrics(text);
      expect(metrics.word_count).toBe(0);
      expect(metrics.character_count).toBe(8); // Length of whitespace string
      expect(metrics.cefr_level).toBe("A1");
    });

    it('handles punctuation correctly', () => {
      const text = "Hello, world! This is a test.";
      const metrics = computeMetrics(text);
      // "Hello," "world!" "This" "is" "a" "test." -> 6 tokens
      expect(metrics.word_count).toBe(6);
      expect(metrics.unique_words).toBe(6);
    });

    it('calculates low CEFR (A1) for simple text', () => {
      // Very short sentences, simple words -> Lower CEFR
      const text = "I go to the shop. It is big. I see a cat. The dog is nice.";
      const metrics = computeMetrics(text);
      expect(metrics.cefr_level).toBe("A1");
    });

    it('calculates high CEFR (B2/C1) for complex text', () => {
      // Longer sentences, complex words -> Higher CEFR
      // "Fundamental", "understanding", "algorithms", "essential", "software", "development"
      const text = "A fundamental understanding of intricate algorithms is absolutely essential for comprehensive software development.";
      const metrics = computeMetrics(text);
      
      // We expect a higher level. Rust test expected B2 or C1 or C2.
      const highLevels = ["B2", "C1", "C2"];
      expect(highLevels).toContain(metrics.cefr_level);
    });

    it('handles noise/punctuation strings', () => {
      const text = "   ...   ";
      const metrics = computeMetrics(text);
      // The implementation splits by whitespace, "..." is a token, but then cleanup logic:
      // cleanWord = "..." -> replace non-alpha -> "" -> continue
      // So word count for metrics purposes (cleaned words) vs raw split might differ?
      // Let's check logic:
      // New regex-based tokenizer correctly identifies "..." as 0 words.
      expect(metrics.word_count).toBe(0);
      expect(metrics.unique_words).toBe(0);
      expect(metrics.cefr_level).toBe("A1");
    });

    it('counts unique words correctly (case insensitive)', () => {
      const text = "Test test TEST";
      const metrics = computeMetrics(text);
      expect(metrics.unique_words).toBe(1);
    });

    it('identifies complex words correctly', () => {
        // "the" is common, "xylophone" is complex
        const text = "The xylophone is loud";
        const metrics = computeMetrics(text);
        // Common: the, is. Complex: xylophone, loud.
        expect(metrics.complex_words).toBe(2);
    });
  });
});
