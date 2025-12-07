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
        
        // 1. Check for repeated words (e.g., "the the")
        // Case insensitive, ensures word boundary
        const repeatedWordRegex = /\b(\w+)\s+\1\b/gi;
        let match;
        while ((match = repeatedWordRegex.exec(text)) !== null) {
            issues.push({
                message: `Double word detected: "${match[0]}"`,
                offset: match.index,
                length: match[0].length,
                type: 'warning',
                replacement: match[1]
            });
        }

        // 2. Check for "a" vs "an" (Simplified heuristic)
        // Matches "a" followed by vowel, or "an" followed by consonant
        const aAnRegex = /\b(a)\s+([aeiou]\w+)| \b(an)\s+([bcdfghjklmnpqrstvwxyz]\w+)/gi;
        while ((match = aAnRegex.exec(text)) !== null) {
            const word = match[0];
            const isAError = word.toLowerCase().startsWith('a ');
            issues.push({
                message: isAError ? `Should this be "an"?` : `Should this be "a"?`,
                offset: match.index,
                length: match[0].length,
                type: 'warning'
            });
        }

        // 3. Weak Vocabulary Suggestions
        const weakWords = [
            { word: 'very good', stronger: ['excellent', 'superb', 'outstanding'] },
            { word: 'very bad', stronger: ['terrible', 'awful', 'dreadful'] },
            { word: 'very big', stronger: ['massive', 'huge', 'enormous'] },
            { word: 'very small', stronger: ['tiny', 'minuscule'] },
            { word: 'very happy', stronger: ['thrilled', 'delighted', 'elated'] },
            { word: 'very sad', stronger: ['devastated', 'heartbroken'] },
            { word: 'a lot of', stronger: ['numerous', 'many', 'significant'] }
        ];

        weakWords.forEach(item => {
            const regex = new RegExp(`\\b${item.word}\\b`, 'gi');
            while ((match = regex.exec(text)) !== null) {
                 issues.push({
                    message: `Try a stronger word instead of "${item.word}"`,
                    offset: match.index,
                    length: match[0].length,
                    type: 'suggestion',
                    replacement: item.stronger.join(' / ')
                });
            }
        });

        // 4. Sentence Length Warning (Run-on sentences)
        // If a sentence (split by .!?) is > 40 words
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let runningOffset = 0;
        sentences.forEach(sent => {
            const wordCount = sent.trim().split(/\s+/).length;
            if (wordCount > 35) {
                issues.push({
                    message: `Long sentence (${wordCount} words). Consider breaking it up.`,
                    offset: runningOffset,
                    length: sent.length,
                    type: 'warning'
                });
            }
            runningOffset += sent.length;
        });

        return issues.sort((a, b) => a.offset - b.offset);
    }
}
