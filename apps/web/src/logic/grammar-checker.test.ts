import { describe, it, expect } from 'vitest';
import { GrammarChecker } from './grammar-checker';

describe('GrammarChecker', () => {
    it('detects weak verbs (get/got)', () => {
        const text = "I got a new car.";
        const issues = GrammarChecker.check(text);
        const issue = issues.find(i => i.message.includes('Avoid "get/got"'));
        expect(issue).toBeDefined();
        expect(issue?.replacement).toContain('obtain');
    });

    it('detects weak verbs (look at)', () => {
        const text = "Look at this.";
        const issues = GrammarChecker.check(text);
        const issue = issues.find(i => i.message.includes("Look at"));
        // "Look at" logic might be slightly different in implementation, let's check
        // The implementation checks: root === 'look' && v.has('at')
        // We know 'look' is the root, so this should match if toInfinitive works.
        const lookIssue = issues.find(i => i.message.includes("'look at'"));
        expect(lookIssue).toBeDefined(); 
    });

    it('detects weak adjectives (very fast)', () => {
        const text = "It was very good.";
        const issues = GrammarChecker.check(text);
        const issue = issues.find(i => i.message.includes('stronger adjective'));
        expect(issue).toBeDefined();
        expect(issue?.replacement).toContain('excellent');
    });

    it('detects repetitive starters', () => {
        const text = "I went to the shop. I bought some milk. I went home.";
        const issues = GrammarChecker.check(text);
        const issue = issues.find(i => i.message.includes('Repetitive start'));
        expect(issue).toBeDefined();
    });

    it('detects filler words', () => {
        // Needs > 20 words for density check
        const text = "Um, I think that like, sort of, we should, um, go to the, uh, place where the things are, um, because I like it.";
        const issues = GrammarChecker.check(text);
        const issue = issues.find(i => i.message.includes('Filler words detected'));
        expect(issue).toBeDefined();
    });

    it('detects run-on sentences', () => {
        // > 40 words
        const text = "This is a very long sentence that keeps going and going and going and never seems to stop because it has so many words and clauses that it just becomes difficult to follow what is being said and the listener gets tired.";
        const issues = GrammarChecker.check(text);
        const issue = issues.find(i => i.message.includes('Long sentence'));
        expect(issue).toBeDefined();
    });

    it('detects subject-verb agreement errors', () => {
        const text = "He go to the store.";
        const issues = GrammarChecker.check(text);
        const issue = issues.find(i => i.message.includes('Possible agreement error'));
        expect(issue).toBeDefined();
    });

    it('runs without crashing on empty input', () => {
        const text = "";
        const issues = GrammarChecker.check(text);
        expect(issues).toEqual([]);
    });
});
