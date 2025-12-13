import nlp from 'compromise';

export interface GrammarIssue {
    message: string;
    offset: number;
    length: number;
    type: 'warning' | 'suggestion' | 'praise';
    replacement?: string;
    category?: 'vocabulary' | 'clarity' | 'confidence' | 'grammar';
}

export interface AnalysisResult {
    issues: GrammarIssue[];
    clarityScore: number;
    positivePoints: string[];
}

export class GrammarChecker {
    static check(text: string): AnalysisResult {
        const issues: GrammarIssue[] = [];
        const positivePoints: string[] = [];
        const doc = nlp(text);
        
        // Track negative factors for clarity score
        let clarityDeductions = 0;

        // 1. Weak Vocabulary & Synonyms
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
                 clarityDeductions += 1;
             }
        });

        // 1b. Weak Words (Single terms)
        const weakWords = [
            { word: 'stuff', replacement: 'aspects / elements', msg: 'vague' },
            { word: 'things', replacement: 'factors / items', msg: 'vague' },
            { word: 'really', replacement: 'truly / genuinely', msg: 'weak intensifier' }
        ];
        
        weakWords.forEach(w => {
            doc.match(w.word).forEach((m: any) => {
                // simple check to avoid partial matches if needed, but match() is token based usually
                 const json = m.json({ offset: true });
                 issues.push({
                     message: `"${m.text()}" is ${w.msg}.`,
                     offset: json[0].offset.start,
                     length: json[0].length,
                     type: 'suggestion',
                     replacement: w.replacement,
                     category: 'vocabulary'
                 });
                 clarityDeductions += 1;
            });
        });

        // 2. Weak Verbs (Get/Got/Look)
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

        // 3. Hedging (Confidence)
        // Phrases that lower authority
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
            clarityDeductions += 3;
        });

        // 4. Passive Voice (Clarity)
        // heuristic: Match a sequence of Passive usage followed by 'by'
        // This is more robust than looking for specific auxiliaries
        doc.match('#Passive+ by').forEach((m: any) => {
             const json = m.json({ offset: true });
             issues.push({
                message: `Passive voice detected. Active voice is stronger and clearer.`,
                offset: json[0].offset.start,
                length: json[0].length,
                type: 'suggestion',
                category: 'clarity'
            });
            clarityDeductions += 2;
        });

        // 5. Repeated Sentence Starters
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
                 clarityDeductions += 2;
             }
        });

        // 6. Filler Words
        const fillers = doc.match('(um|uh|like|sort of|kind of)').not('#Verb'); 
        const fillerCount = fillers.length;
        if (fillerCount > 0) {
            clarityDeductions += (fillerCount * 2);
            // Only warn if density is high
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
        
        // 7. Run-on Sentences
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
                clarityDeductions += 5;
            }
        });

        // 8. Positive Reinforcement
        // Search for strong vocabulary
        const strongWords = '(excellent|superb|crucial|essential|demonstrate|illustrate|comprehensive|meticulous|resilient|innovative|fundamental|significant|profound|compelling)';
        const foundStrong = doc.match(strongWords).unique().out('array');
        if (foundStrong.length > 0) {
            positivePoints.push(`Used strong vocabulary: ${foundStrong.slice(0, 3).join(", ")}`);
        }
        
        // Calculate Clarity Score
        // Base 100, bounded 0-100.
        // Penalty logic is subjective but functional for feedback.
        const totalWords = doc.wordCount();
        if (totalWords < 10) {
             // Too short to judge fairly
             clarityDeductions = 0; 
        }
        let score = 100 - clarityDeductions;
        if (totalWords > 0) {
             // Normalize slightly? If deduction is absolute, a long speech gets 0 score.
             // Let's make deduction relative to length roughly.
             // Actually, let's keep absolute deductions for specific errors, but maybe cap deduction per type?
             // Simple approach: Score = 100 - (deductions / (totalWords/50 + 1)) ?? 
             // Let's stick to simple: defects reduce score. Hedges are bad regardless of length.
             // But 20 fillers in 1000 words vs 20 in 50 words is different.
             // Let's use density for score.
             
             // Density Score
             const defects = clarityDeductions; // roughly counting "bad things"
             const defectsPer100Words = (defects / Math.max(totalWords, 1)) * 100;
             // If 10 defects per 100 words, that's bad.
             // Score = 100 - (defectsPer100Words * 2)
             score = Math.round(100 - (defectsPer100Words * 3));
        }
        
        return {
            issues: issues.sort((a, b) => a.offset - b.offset),
            clarityScore: Math.max(0, Math.min(100, score)),
            positivePoints
        };
    }
}
