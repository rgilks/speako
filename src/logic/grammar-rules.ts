export interface GrammarIssue {
  message: string;
  offset: number;
  length: number;
  type: 'warning' | 'suggestion' | 'praise';
  replacement?: string;
  category?: 'vocabulary' | 'clarity' | 'confidence' | 'grammar';
}

export interface ClarityState {
  deductions: number;
}

const DEDUCTION_VALUES = {
  WEAK_ADJECTIVE: 1,
  WEAK_WORD: 1,
  HEDGING: 3,
  PASSIVE_VOICE: 2,
  REPETITIVE_STARTER: 2,
  FILLER_MULTIPLIER: 2,
  RUN_ON_SENTENCE: 5,
} as const;

const MIN_WORDS_FOR_SCORE = 10;
const MIN_WORDS_FOR_FILLER_WARNING = 20;
const FILLER_DENSITY_THRESHOLD = 0.05;
const MAX_SENTENCE_LENGTH = 40;
const SCORE_MULTIPLIER = 3;
const MAX_POSITIVE_WORDS = 3;

const WEAK_ADJECTIVE_REPLACEMENTS: Record<string, string> = {
  good: 'excellent / superb',
  bad: 'terrible / awful',
  big: 'massive / enormous',
  small: 'tiny / minuscule',
  happy: 'thrilled / elated',
  sad: 'devastated',
  nice: 'delightful / pleasant',
  interesting: 'fascinating / intriguing',
};

function getOffsetAndLength(match: any): { offset: number; length: number } {
  const json = match.json({ offset: true });
  return {
    offset: json[0].offset.start,
    length: json[0].length,
  };
}

function createIssue(
  match: any,
  message: string,
  type: GrammarIssue['type'],
  category: GrammarIssue['category'],
  replacement?: string
): GrammarIssue {
  const { offset, length } = getOffsetAndLength(match);
  return {
    message,
    offset,
    length,
    type,
    category,
    replacement,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkWeakAdjectives(doc: any, issues: GrammarIssue[], state: ClarityState) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.match('very #Adjective').forEach((m: any) => {
    const weak = m.text().toLowerCase();
    const replacement = Object.entries(WEAK_ADJECTIVE_REPLACEMENTS).find(([key]) =>
      weak.includes(key)
    )?.[1];

    if (replacement) {
      issues.push(
        createIssue(
          m,
          `Upgrade "${m.text()}" to a stronger adjective.`,
          'suggestion',
          'vocabulary',
          replacement
        )
      );
      state.deductions += DEDUCTION_VALUES.WEAK_ADJECTIVE;
    }
  });
}

const WEAK_WORDS = [
  { word: 'stuff', replacement: 'aspects / elements', msg: 'vague' },
  { word: 'things', replacement: 'factors / items', msg: 'vague' },
  { word: 'really', replacement: 'truly / genuinely', msg: 'weak intensifier' },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkWeakWords(doc: any, issues: GrammarIssue[], state: ClarityState) {
  WEAK_WORDS.forEach((w) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc.match(w.word).forEach((m: any) => {
      issues.push(
        createIssue(m, `"${m.text()}" is ${w.msg}.`, 'suggestion', 'vocabulary', w.replacement)
      );
      state.deductions += DEDUCTION_VALUES.WEAK_WORD;
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkWeakVerbs(doc: any, issues: GrammarIssue[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.verbs().forEach((v: any) => {
    const root = v.toInfinitive().text().toLowerCase();
    if (root === 'get' || root === 'got') {
      issues.push(
        createIssue(
          v,
          'Avoid "get/got" in formal speaking.',
          'suggestion',
          'vocabulary',
          'obtain / receive / become'
        )
      );
    }
    if (root === 'look' && v.has('at')) {
      issues.push(
        createIssue(
          v,
          "Try 'examine' or 'observe' instead of 'look at'.",
          'suggestion',
          'vocabulary'
        )
      );
    }
  });
}

const HEDGING_PATTERN = '(i guess|i suppose|sort of|kind of|maybe|basically|virtually|apparently)';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkHedging(doc: any, issues: GrammarIssue[], state: ClarityState) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.match(HEDGING_PATTERN).forEach((m: any) => {
    issues.push(
      createIssue(
        m,
        `Hedging detected ("${m.text()}"). Sound more confident by removing this.`,
        'warning',
        'confidence'
      )
    );
    state.deductions += DEDUCTION_VALUES.HEDGING;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkPassiveVoice(doc: any, issues: GrammarIssue[], state: ClarityState) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.match('#Passive+ by').forEach((m: any) => {
    issues.push(
      createIssue(
        m,
        'Passive voice detected. Active voice is stronger and clearer.',
        'suggestion',
        'clarity'
      )
    );
    state.deductions += DEDUCTION_VALUES.PASSIVE_VOICE;
  });
}

const REPETITIVE_STARTER_WORDS = new Set(['i', 'the', 'and']);

function getFirstWord(sentence: any): string {
  return sentence
    .terms()
    .first()
    .text()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkRepetitiveStarters(doc: any, issues: GrammarIssue[], state: ClarityState) {
  const sentenceList = doc.sentences();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sentenceList as any).forEach((s: any, i: number) => {
    if (i === 0) return;

    const firstWord = getFirstWord(s);
    const prev = getFirstWord(sentenceList.eq(i - 1));

    if (firstWord === prev && REPETITIVE_STARTER_WORDS.has(firstWord)) {
      issues.push(
        createIssue(
          s.first(),
          `Repetitive sentence start ("${firstWord}..."). Vary your connectors.`,
          'suggestion',
          'clarity'
        )
      );
      state.deductions += DEDUCTION_VALUES.REPETITIVE_STARTER;
    }
  });
}

const FILLER_PATTERN = '(um|uh|like|sort of|kind of)';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkFillerWords(doc: any, issues: GrammarIssue[], state: ClarityState) {
  const fillers = doc.match(FILLER_PATTERN).not('#Verb');
  const fillerCount = fillers.length;
  if (fillerCount > 0) {
    state.deductions += fillerCount * DEDUCTION_VALUES.FILLER_MULTIPLIER;
    const wordCount = doc.wordCount();
    if (
      wordCount > MIN_WORDS_FOR_FILLER_WARNING &&
      fillerCount / wordCount > FILLER_DENSITY_THRESHOLD
    ) {
      issues.push({
        message: `High usage of filler words detected (${fillerCount}). Try pausing silently instead.`,
        offset: 0,
        length: 0,
        type: 'warning',
        category: 'clarity',
      });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkRunOnSentences(doc: any, issues: GrammarIssue[], state: ClarityState) {
  const sentenceList = doc.sentences();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sentenceList.forEach((s: any) => {
    const count = s.wordCount();
    if (count > MAX_SENTENCE_LENGTH) {
      issues.push(
        createIssue(
          s,
          `Long sentence (${count} words). Consider breaking it up.`,
          'warning',
          'clarity'
        )
      );
      state.deductions += DEDUCTION_VALUES.RUN_ON_SENTENCE;
    }
  });
}

const STRONG_WORDS_PATTERN =
  '(excellent|superb|crucial|essential|demonstrate|illustrate|comprehensive|meticulous|resilient|innovative|fundamental|significant|profound|compelling)';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findPositivePoints(doc: any, positivePoints: string[]) {
  const foundStrong = doc.match(STRONG_WORDS_PATTERN).unique().out('array');
  if (foundStrong.length > 0) {
    positivePoints.push(
      `Used strong vocabulary: ${foundStrong.slice(0, MAX_POSITIVE_WORDS).join(', ')}`
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculateClarityScore(doc: any, state: ClarityState): number {
  const totalWords = doc.wordCount();
  if (totalWords < MIN_WORDS_FOR_SCORE) return 100;

  const defects = state.deductions;
  const defectsPer100Words = (defects / Math.max(totalWords, 1)) * 100;
  return Math.max(0, Math.min(100, Math.round(100 - defectsPer100Words * SCORE_MULTIPLIER)));
}
