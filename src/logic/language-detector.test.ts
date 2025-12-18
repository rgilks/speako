import { describe, it, expect } from 'vitest';
import { detectEnglish } from './language-detector';

describe('detectEnglish', () => {
  it('identifies simple English sentences', () => {
    const result = detectEnglish('Hello how are you today');
    expect(result.isLikelyEnglish).toBe(true);
    expect(result.confidence).toBe(1.0);
  });

  it('identifies complex English sentences', () => {
    const result = detectEnglish('The quick brown fox jumps over the lazy dog');
    expect(result.isLikelyEnglish).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('identifies advanced scientific English', () => {
    // "The", "of" are core words. 2/7 = 0.29 > 0.15
    const result = detectEnglish('The spectroscopic analysis indicated presence of isotopes');
    expect(result.isLikelyEnglish).toBe(true);
  });

  it('identifies advanced philosophical English', () => {
    // "to" is a core word. 1/6 = 0.16 > 0.15
    const result = detectEnglish(
      'Phenomenological approaches to consciousness remain controversial'
    );
    expect(result.isLikelyEnglish).toBe(true);
  });

  it('identifies French as non-English', () => {
    const result = detectEnglish('Bonjour comment ça va');
    expect(result.isLikelyEnglish).toBe(false);
    expect(result.confidence).toBeLessThan(0.4);
  });

  it('identifies Spanish as non-English', () => {
    const result = detectEnglish('Hola como estas muy bien');
    expect(result.isLikelyEnglish).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('handles empty input', () => {
    const result = detectEnglish('');
    expect(result.isLikelyEnglish).toBe(true); // Default safe fallback
    expect(result.wordCount).toBe(0);
  });

  it('handles mixed content favoring English majority', () => {
    // "Computer" and "my" are common, "ordinateur" is not.
    // "This is my ordinateur" -> "This", "is", "my" are common. 3/4 = 0.75
    const result = detectEnglish('This is my ordinateur');
    expect(result.isLikelyEnglish).toBe(true);
  });
});
