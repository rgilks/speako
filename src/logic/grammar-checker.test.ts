import { describe, it, expect } from 'vitest';
import { GrammarChecker } from './grammar-checker';

describe('GrammarChecker', () => {
  it('detects weak adjectives', () => {
    const result = GrammarChecker.check("This is very good stuff.");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'suggestion',
          category: 'vocabulary',
          message: expect.stringContaining('stronger adjective'),
          replacement: 'excellent / superb'
        })
      ])
    );
     // "stuff" should also be flagged
    expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
             message: expect.stringContaining('"stuff" is vague')
          })
        ])
    );
  });

  it('detects weak verbs (get/got)', () => {
    const result = GrammarChecker.check("I got a new job.");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('Avoid "get/got"'),
        replacement: 'obtain / receive / become'
      })
    );
  });

  it('detects hedging phrases', () => {
    // Needs > 10 words to trigger clarity score deductions
    const result = GrammarChecker.check("I guess we should sort of go to the store and buy some milk.");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        type: 'warning',
        category: 'confidence',
        message: expect.stringContaining('Hedging detected')
      })
    );
    // Should have a lower clarity score due to hedges
    expect(result.clarityScore).toBeLessThan(100);
  });

  it('detects passive voice', () => {
    const result = GrammarChecker.check("The decision was made by the team.");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        category: 'clarity',
        message: expect.stringContaining('Passive voice detected')
      })
    );
  });

  it('identifies positive reinforcement words', () => {
    const result = GrammarChecker.check("This demonstrates a crucial innovation.");
    expect(result.positivePoints).toHaveLength(1);
    expect(result.positivePoints[0]).toContain("demonstrate"); // or crucial/innovation depending on order
  });

    it('calculates clarity score correctly', () => {
        // Perfect sentence
        const good = GrammarChecker.check("The rapid fox jumps over the lazy dog.");
        // Short sentences might have 0 deductions but score logic handles short length
        // Let's rely on no issues = high score
        expect(good.issues).toHaveLength(0);
        expect(good.clarityScore).toBe(100);

        // Bad sentence
        const bad = GrammarChecker.check("I guess it is sort of basically um like very good stuff.");
        expect(bad.clarityScore).toBeLessThan(70);
    });
    
    it('handles repetitive sentence starters', () => {
        const text = "I went to the store. I bought milk. I came home.";
        const result = GrammarChecker.check(text);
        expect(result.issues).toContainEqual(
            expect.objectContaining({
                message: expect.stringContaining('Repetitive sentence start')
            })
        );
    });
});
