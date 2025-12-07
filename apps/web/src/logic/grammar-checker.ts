import nlp from 'compromise';

export interface GrammarIssue {
    message: string;
    offset: number;
    length: number;
    type: 'warning' | 'suggestion';
    replacement?: string;
}

export class GrammarChecker {
    static check(text: string): GrammarIssue[] {
        const issues: GrammarIssue[] = [];
        const doc = nlp(text);

        // 1. Weak Vocabulary (Using NLP tagging)
        // Check for "very + Adjective" to suggest stronger adjectives
        doc.match('very #Adjective').forEach((m: any) => {
             const weak = m.text().toLowerCase();
             let replacement = '';
             
             if (weak.includes('good')) replacement = 'excellent / superb';
             else if (weak.includes('bad')) replacement = 'terrible / awful';
             else if (weak.includes('big')) replacement = 'massive / enormous';
             else if (weak.includes('small')) replacement = 'tiny / minuscule';
             else if (weak.includes('happy')) replacement = 'thrilled / elated';
             else if (weak.includes('sad')) replacement = 'devastated';
             
             if (replacement) {
                 const json = m.json({ offset: true });
                 issues.push({
                     message: `Use a stronger adjective instead of "${m.text()}"`,
                     offset: json[0].offset.start,
                     length: json[0].length,
                     type: 'suggestion',
                     replacement
                 });
             }
        });

        // 2. Weak Verbs (Get/Got/Look)
        doc.verbs().forEach((v: any) => {
             const root = v.root().text().toLowerCase();
             if (root === 'get' || root === 'got') {
                 const json = v.json({ offset: true });
                 issues.push({
                     message: `Avoid "get/got" in formal speaking. Try 'obtain', 'receive', or 'become'.`,
                     offset: json[0].offset.start,
                     length: json[0].length,
                     type: 'suggestion',
                     replacement: 'obtain / receive'
                 });
             }
             if (root === 'look' && v.has('at')) {
                  const json = v.json({ offset: true });
                  issues.push({
                     message: `Try 'examine' or 'observe' instead of 'look at'.`,
                     offset: json[0].offset.start,
                     length: json[0].length,
                     type: 'suggestion'
                 });
             }
        });

        // 3. Subject-Verb Agreement Heuristics
        // "He go" -> match singular pronoun + infinite verb (that isn't a modal like 'can go')
        // Exclude 'I' and 'You' which take plural-like forms
        doc.match('(he|she|it) #Infinitive').not('#Modal').forEach((m: any) => {
             const json = m.json({ offset: true });
             // Quick check to avoid false positives with "did he go"
             if (!m.lookBehind('did').found) {
                 issues.push({
                    message: `Possible agreement error: "${m.text()}". Should it be 3rd person singular? (e.g. goes, runs)`,
                    offset: json[0].offset.start,
                    length: json[0].length,
                    type: 'warning'
                });
             }
        });

        // 4. Repeated Sentence Starters (Anaphora)
        const sentences = doc.sentences().json();
        let prevStart = "";
        let consecutiveCount = 0;
        
        // We need to re-map sentence indices to text offsets manually since json() might chunk differently
        // Simplified approach using raw text split for offset calculation if needed, 
        // but nlp logic is better for the check itself.
        // Let's iterate using the nlp sentence objects directly
        const sentenceList = doc.sentences();
        (sentenceList as any).forEach((s: any, i: number) => {
             if (i === 0) return;
             
             const firstWord = s.first().text().toLowerCase();
             const prev = sentenceList.eq(i-1).first().text().toLowerCase();
             
             if (firstWord === prev && (firstWord === 'i' || firstWord === 'the' || firstWord === 'and')) {
                  // Only flag common weaker starters
                  const json = s.first().json({ offset: true });
                  issues.push({
                     message: `Repetitive start ("${firstWord}..."). Try to vary your sentence connectors.`,
                     offset: json[0].offset.start,
                     length: json[0].length,
                     type: 'suggestion'
                 });
             }
        });

        // 5. Filler Words (NLP tagged)
        const fillers = doc.match('(um|uh|like|sort of|kind of)').not('#Verb'); // exclude "I like"
        const wordCount = doc.wordCount();
        if (wordCount > 20 && (fillers.length / wordCount) > 0.05) {
             issues.push({
                message: `Filler words detected (${fillers.length}). Try pausing silently instead.`,
                offset: 0,
                length: 0,
                type: 'warning'
            });
        }
        
        // 6. Run-on Sentences
        sentenceList.forEach((s: any) => {
            if (s.wordCount() > 40) {
                 const json = s.json({ offset: true });
                 issues.push({
                    message: `Long sentence (${s.wordCount()} words). Risk of losing clarity.`,
                    offset: json[0].offset.start,
                    length: json[0].length,
                    type: 'warning'
                });
            }
        });

        return issues.sort((a, b) => a.offset - b.offset);
    }
}
