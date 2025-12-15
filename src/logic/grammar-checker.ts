import nlp from 'compromise';
import * as Rules from './grammar-rules';

export interface AnalysisResult {
  issues: Rules.GrammarIssue[];
  clarityScore: number;
  positivePoints: string[];
}

export type { GrammarIssue } from './grammar-rules';

function applyRules(doc: any, issues: Rules.GrammarIssue[], state: Rules.ClarityState): void {
  Rules.checkWeakAdjectives(doc, issues, state);
  Rules.checkWeakWords(doc, issues, state);
  Rules.checkWeakVerbs(doc, issues);
  Rules.checkHedging(doc, issues, state);
  Rules.checkPassiveVoice(doc, issues, state);
  Rules.checkRepetitiveStarters(doc, issues, state);
  Rules.checkFillerWords(doc, issues, state);
  Rules.checkRunOnSentences(doc, issues, state);
}

export class GrammarChecker {
  static check(text: string): AnalysisResult {
    const issues: Rules.GrammarIssue[] = [];
    const positivePoints: string[] = [];
    const doc = nlp(text);
    const state: Rules.ClarityState = { deductions: 0 };

    applyRules(doc, issues, state);
    Rules.findPositivePoints(doc, positivePoints);

    const clarityScore = Rules.calculateClarityScore(doc, state);

    return {
      issues: issues.sort((a, b) => a.offset - b.offset),
      clarityScore,
      positivePoints,
    };
  }
}
