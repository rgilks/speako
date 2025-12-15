import { describe, it, expect } from 'vitest';
import { GrammarChecker } from './grammar-checker';

describe('GrammarChecker', () => {
  it('detects weak adjectives', () => {
    const result = GrammarChecker.check('This is very good stuff.');

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'suggestion',
          category: 'vocabulary',
          message: expect.stringContaining('stronger adjective'),
          replacement: 'excellent / superb',
        }),
        expect.objectContaining({
          message: expect.stringContaining('"stuff" is vague'),
        }),
      ])
    );
  });

  it('detects weak verbs', () => {
    const result = GrammarChecker.check('I got a new job.');

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('Avoid "get/got"'),
        replacement: 'obtain / receive / become',
      })
    );
  });

  it('detects hedging phrases', () => {
    const result = GrammarChecker.check(
      'I guess we should sort of go to the store and buy some milk.'
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        type: 'warning',
        category: 'confidence',
        message: expect.stringContaining('Hedging detected'),
      })
    );
    expect(result.clarityScore).toBeLessThan(100);
  });

  it('detects passive voice', () => {
    const result = GrammarChecker.check('The decision was made by the team.');

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        category: 'clarity',
        message: expect.stringContaining('Passive voice detected'),
      })
    );
  });

  it('identifies positive reinforcement words', () => {
    const result = GrammarChecker.check('This demonstrates a crucial innovation.');

    expect(result.positivePoints).toHaveLength(1);
    expect(result.positivePoints[0]).toMatch(/demonstrate|crucial|innovation/);
  });

  it('calculates clarity score correctly', () => {
    const good = GrammarChecker.check('The rapid fox jumps over the lazy dog.');
    expect(good.issues).toHaveLength(0);
    expect(good.clarityScore).toBe(100);

    const bad = GrammarChecker.check('I guess it is sort of basically um like very good stuff.');
    expect(bad.clarityScore).toBeLessThan(70);
  });

  it('detects repetitive sentence starters', () => {
    const result = GrammarChecker.check('I went to the store. I bought milk. I came home.');

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('Repetitive sentence start'),
      })
    );
  });
});
