import { describe, it, expect } from 'vitest';
import nlp from 'compromise';
import * as Rules from './grammar-rules';

describe('Grammar Rules', () => {
    describe('checkWeakAdjectives', () => {
        it('identifies weak adjectives and offers replacements', () => {
            const doc = nlp("This is very good.");
            const issues: Rules.GrammarIssue[] = [];
            const state: Rules.ClarityState = { deductions: 0 };
            
            Rules.checkWeakAdjectives(doc, issues, state);
            
            expect(issues).toHaveLength(1);
            expect(issues[0].replacement).toBe('excellent / superb');
            expect(state.deductions).toBe(1);
        });

        it('ignores strong adjectives', () => {
            const doc = nlp("This is superb.");
            const issues: Rules.GrammarIssue[] = [];
            const state: Rules.ClarityState = { deductions: 0 };
            
            Rules.checkWeakAdjectives(doc, issues, state);
            
            expect(issues).toHaveLength(0);
        });
    });

    describe('checkWeakWords', () => {
        it('flags vague words like stuff and things', () => {
            const doc = nlp("I have stuff and things to do.");
            const issues: Rules.GrammarIssue[] = [];
            const state: Rules.ClarityState = { deductions: 0 };
            
            Rules.checkWeakWords(doc, issues, state);
            
            expect(issues).toHaveLength(2);
            expect(issues.map(i => i.message)).toEqual(
                expect.arrayContaining([expect.stringContaining('"stuff" is vague'), expect.stringContaining('"things" is vague')])
            );
        });
    });

    describe('checkWeakVerbs', () => {
        it('flags use of get/got', () => {
            const doc = nlp("I got a promotion.");
            const issues: Rules.GrammarIssue[] = [];
            
            Rules.checkWeakVerbs(doc, issues);
            
            expect(issues).toHaveLength(1);
            expect(issues[0].message).toContain('Avoid "get/got"');
        });
    });

    describe('checkHedging', () => {
        it('detects hedging phrases', () => {
            const doc = nlp("I guess maybe it works.");
            const issues: Rules.GrammarIssue[] = [];
            const state: Rules.ClarityState = { deductions: 0 };
            
            Rules.checkHedging(doc, issues, state);
            
            // "I guess" and "maybe" might both trigger depending on overlapping matches, 
            // but compromise usually handles distinct matches.
            // Let's check at least one.
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0].category).toBe('confidence');
        });
    });

    describe('checkPassiveVoice', () => {
        it('detects passive voice constructions', () => {
            // "was made by"
            const doc = nlp("Mistakes were made by the developer.");
            const issues: Rules.GrammarIssue[] = [];
            const state: Rules.ClarityState = { deductions: 0 };
            
            Rules.checkPassiveVoice(doc, issues, state);
            
            expect(issues).toHaveLength(1);
            expect(issues[0].category).toBe('clarity');
        });
    });

    describe('checkFillerWords', () => {
        it('penalizes filler words', () => {
            const doc = nlp("It was, like, um, kind of cool.");
            const issues: Rules.GrammarIssue[] = [];
            const state: Rules.ClarityState = { deductions: 0 };
            
            Rules.checkFillerWords(doc, issues, state);
            
            // 3 fillers: like, um, kind of
            // Deductions logic: count * 2?
            expect(state.deductions).toBeGreaterThan(0);
            
            // It might also push a warning if density is high
            // "It was like um kind of cool" -> ~7 words. 3 fillers. 3/7 > 0.05.
            // Should prompt warning? But word count check says > 20 words.
            // So no issue pushed, just deduction.
            expect(issues).toHaveLength(0);
        });
        
        it('pushes warning if density is high and text is long enough', () => {
             const text = "um ".repeat(5) + " word ".repeat(20);
             const doc = nlp(text);
             const issues: Rules.GrammarIssue[] = [];
             const state: Rules.ClarityState = { deductions: 0 };
             
             Rules.checkFillerWords(doc, issues, state);
             expect(issues).toHaveLength(1);
             expect(issues[0].message).toContain('High usage of filler words');
        });
    });

    describe('calculateClarityScore', () => {
        it('returns 100 for short text (<10 words)', () => {
            const doc = nlp("Too short.");
            const state: Rules.ClarityState = { deductions: 50 }; // massive deductions
            const score = Rules.calculateClarityScore(doc, state);
            expect(score).toBe(100);
        });

        it('calculates score based on deductions', () => {
            const doc = nlp("One two three four five six seven eight nine ten eleven.");
            const state: Rules.ClarityState = { deductions: 2 }; 
            // 11 words. 2 defects. defectsPer100 = (2/11)*100 = 18.18
            // Score = 100 - (18.18 * 3) = 100 - 54.5 = 45.5 -> 46
            const score = Rules.calculateClarityScore(doc, state);
            expect(score).toBeLessThan(100);
        });
    });
});
