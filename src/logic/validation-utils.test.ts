/**
 * Tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import { normalize, calculateWER, shuffleArray, parseSTM } from './validation-utils';

describe('validation-utils', () => {
  describe('normalize', () => {
    it('converts to lowercase', () => {
      expect(normalize('Hello World')).toBe('hello world');
    });

    it('removes punctuation', () => {
      expect(normalize('Hello, world!')).toBe('hello world');
    });

    it('collapses whitespace', () => {
      expect(normalize('hello    world')).toBe('hello world');
    });

    it('trims whitespace', () => {
      expect(normalize('  hello world  ')).toBe('hello world');
    });
  });

  describe('calculateWER', () => {
    it('returns 0 for identical strings', () => {
      expect(calculateWER('hello world', 'hello world')).toBe(0);
    });

    it('returns 0 for case-insensitive match', () => {
      expect(calculateWER('Hello World', 'hello world')).toBe(0);
    });

    it('calculates WER for substitutions', () => {
      // "hello world" vs "hello there" = 1 substitution / 2 words = 0.5
      expect(calculateWER('hello world', 'hello there')).toBe(0.5);
    });

    it('calculates WER for insertions', () => {
      // "hello" vs "hello world" = 1 insertion / 1 word = 1
      expect(calculateWER('hello', 'hello world')).toBe(1);
    });

    it('calculates WER for deletions', () => {
      // "hello world" vs "hello" = 1 deletion / 2 words = 0.5
      expect(calculateWER('hello world', 'hello')).toBe(0.5);
    });

    it('returns 0 for empty reference and hypothesis', () => {
      expect(calculateWER('', '')).toBe(0);
    });

    it('returns 1 for empty reference with non-empty hypothesis', () => {
      expect(calculateWER('', 'hello')).toBe(1);
    });
  });

  describe('shuffleArray', () => {
    it('returns array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray([...arr]);
      expect(shuffled.length).toBe(arr.length);
    });

    it('contains same elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray([...arr]);
      expect(shuffled.sort()).toEqual(arr.sort());
    });

    it('handles empty array', () => {
      expect(shuffleArray([])).toEqual([]);
    });

    it('handles single element', () => {
      expect(shuffleArray([1])).toEqual([1]);
    });
  });

  describe('parseSTM', () => {
    it('parses valid STM content', () => {
      const stm = `SI1234 1 speaker 0.0 1.0 <o,Q1,B1,P1> hello world`;
      const result = parseSTM(stm);
      expect(result.has('SI1234')).toBe(true);
      expect(result.get('SI1234')?.labeledCEFR).toBe('B1');
      expect(result.get('SI1234')?.transcript).toBe('hello world');
    });

    it('skips comment lines', () => {
      const stm = `;; This is a comment\nSI1234 1 speaker 0.0 1.0 <o,Q1,A2,P1> test`;
      const result = parseSTM(stm);
      expect(result.size).toBe(1);
    });

    it('handles empty content', () => {
      const result = parseSTM('');
      expect(result.size).toBe(0);
    });
  });
});
