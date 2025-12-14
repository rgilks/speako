
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

export function checkWeakAdjectives(doc: any, issues: GrammarIssue[], state: ClarityState) {
    doc.match('very #Adjective').forEach((m: any) => {
        const weak = m.text().toLowerCase();
        let replacement = '';
        
        if (weak.includes('good')) replacement = 'excellent / superb';
        else if (weak.includes('bad')) replacement = 'terrible / awful';
        else if (weak.includes('big')) replacement = 'massive / enormous';
        else if (weak.includes('small')) replacement = 'tiny / minuscule';
        else if (weak.includes('happy')) replacement = 'thrilled / elated';
        else if (weak.includes('sad')) replacement = 'devastated';
        else if (weak.includes('nice')) replacement = 'delightful / pleasant';
        else if (weak.includes('interesting')) replacement = 'fascinating / intriguing';
        
        if (replacement) {
            const json = m.json({ offset: true });
            issues.push({
                message: `Upgrade "${m.text()}" to a stronger adjective.`,
                offset: json[0].offset.start,
                length: json[0].length,
                type: 'suggestion',
                replacement,
                category: 'vocabulary'
            });
            state.deductions += 1;
        }
   });
}

export function checkWeakWords(doc: any, issues: GrammarIssue[], state: ClarityState) {
    const weakWords = [
        { word: 'stuff', replacement: 'aspects / elements', msg: 'vague' },
        { word: 'things', replacement: 'factors / items', msg: 'vague' },
        { word: 'really', replacement: 'truly / genuinely', msg: 'weak intensifier' }
    ];
    
    weakWords.forEach(w => {
        doc.match(w.word).forEach((m: any) => {
             const json = m.json({ offset: true });
             issues.push({
                 message: `"${m.text()}" is ${w.msg}.`,
                 offset: json[0].offset.start,
                 length: json[0].length,
                 type: 'suggestion',
                 replacement: w.replacement,
                 category: 'vocabulary'
             });
             state.deductions += 1;
        });
    });
}

export function checkWeakVerbs(doc: any, issues: GrammarIssue[]) {
    doc.verbs().forEach((v: any) => {
         const root = v.toInfinitive().text().toLowerCase();
         if (root === 'get' || root === 'got') {
             const json = v.json({ offset: true });
             issues.push({
                 message: `Avoid "get/got" in formal speaking.`,
                 offset: json[0].offset.start,
                 length: json[0].length,
                 type: 'suggestion',
                 replacement: 'obtain / receive / become',
                 category: 'vocabulary'
             });
         }
         if (root === 'look' && v.has('at')) {
              const json = v.json({ offset: true });
              issues.push({
                 message: `Try 'examine' or 'observe' instead of 'look at'.`,
                 offset: json[0].offset.start,
                 length: json[0].length,
                 type: 'suggestion',
                 category: 'vocabulary'
             });
         }
    });
}

export function checkHedging(doc: any, issues: GrammarIssue[], state: ClarityState) {
    const hedges = '(i guess|i suppose|sort of|kind of|maybe|basically|virtually|apparently)';
    doc.match(hedges).forEach((m: any) => {
        const json = m.json({ offset: true });
        issues.push({
            message: `Hedging detected ("${m.text()}"). Sound more confident by removing this.`,
            offset: json[0].offset.start,
            length: json[0].length,
            type: 'warning',
            category: 'confidence'
        });
        state.deductions += 3;
    });
}

export function checkPassiveVoice(doc: any, issues: GrammarIssue[], state: ClarityState) {
    doc.match('#Passive+ by').forEach((m: any) => {
         const json = m.json({ offset: true });
         issues.push({
            message: `Passive voice detected. Active voice is stronger and clearer.`,
            offset: json[0].offset.start,
            length: json[0].length,
            type: 'suggestion',
            category: 'clarity'
        });
        state.deductions += 2;
    });
}

export function checkRepetitiveStarters(doc: any, issues: GrammarIssue[], state: ClarityState) {
    const sentenceList = doc.sentences();
    (sentenceList as any).forEach((s: any, i: number) => {
         if (i === 0) return;
         
         const firstWord = s.terms().first().text().toLowerCase().replace(/[^a-z]/g, '');
         const prev = sentenceList.eq(i-1).terms().first().text().toLowerCase().replace(/[^a-z]/g, '');
         
         if (firstWord === prev && (firstWord === 'i' || firstWord === 'the' || firstWord === 'and')) {
              const json = s.first().json({ offset: true });
              issues.push({
                 message: `Repetitive sentence start ("${firstWord}..."). Vary your connectors.`,
                 offset: json[0].offset.start,
                 length: json[0].length,
                 type: 'suggestion',
                 category: 'clarity'
             });
             state.deductions += 2;
         }
    });
}

export function checkFillerWords(doc: any, issues: GrammarIssue[], state: ClarityState) {
    const fillers = doc.match('(um|uh|like|sort of|kind of)').not('#Verb'); 
    const fillerCount = fillers.length;
    if (fillerCount > 0) {
        state.deductions += (fillerCount * 2);
        const wordCount = doc.wordCount();
        if (wordCount > 20 && (fillerCount / wordCount) > 0.05) {
             issues.push({
                message: `High usage of filler words detected (${fillerCount}). Try pausing silently instead.`,
                offset: 0,
                length: 0,
                type: 'warning',
                category: 'clarity'
            });
        }
    }
}

export function checkRunOnSentences(doc: any, issues: GrammarIssue[], state: ClarityState) {
    const sentenceList = doc.sentences();
    sentenceList.forEach((s: any) => {
        const count = s.wordCount();
        if (count > 40) {
             const json = s.json({ offset: true });
             issues.push({
                message: `Long sentence (${count} words). Consider breaking it up.`,
                offset: json[0].offset.start,
                length: json[0].length,
                type: 'warning',
                category: 'clarity'
            });
            state.deductions += 5;
        }
    });
}

export function findPositivePoints(doc: any, positivePoints: string[]) {
    const strongWords = '(excellent|superb|crucial|essential|demonstrate|illustrate|comprehensive|meticulous|resilient|innovative|fundamental|significant|profound|compelling)';
    const foundStrong = doc.match(strongWords).unique().out('array');
    if (foundStrong.length > 0) {
        positivePoints.push(`Used strong vocabulary: ${foundStrong.slice(0, 3).join(", ")}`);
    }
}

export function calculateClarityScore(doc: any, state: ClarityState): number {
    const totalWords = doc.wordCount();
    if (totalWords < 10) return 100;

    const defects = state.deductions; 
    const defectsPer100Words = (defects / Math.max(totalWords, 1)) * 100;
    return Math.max(0, Math.min(100, Math.round(100 - (defectsPer100Words * 3))));
}
