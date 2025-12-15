/**
 * Validation utilities for parsing STM files and calculating WER.
 */

import { STMEntry } from '../types/validation';

/**
 * Normalize text for WER comparison.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse STM file content into a map of file IDs to entries.
 */
export function parseSTM(content: string): Map<string, STMEntry> {
  const entries = new Map<string, STMEntry>();
  const segments: Map<string, { cefr: string; transcripts: string[] }> = new Map();

  for (const line of content.split('\n')) {
    if (line.startsWith(';;') || !line.trim()) continue;

    const match = line.match(/^(\S+)\s+\S+\s+\S+\s+[\d.]+\s+[\d.]+\s+<([^>]+)>\s+(.*)$/);
    if (match) {
      const [, fileId, metadata, transcript] = match;
      // Extract CEFR from metadata like "o,Q4,C,P1" where C = CEFR level
      const cefrMatch = metadata.match(/,([ABC][12]?),/);
      const labeledCEFR = cefrMatch ? cefrMatch[1] : 'Unknown';

      const clean = transcript
        .replace(/\(%[^)]+%\)/g, '')
        .replace(/\([^)]*-\)/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      if (!segments.has(fileId)) {
        segments.set(fileId, { cefr: labeledCEFR, transcripts: [] });
      }
      if (clean) segments.get(fileId)!.transcripts.push(clean);
    }
  }

  for (const [fileId, data] of segments) {
    entries.set(fileId, {
      fileId,
      transcript: data.transcripts.join(' '),
      labeledCEFR: data.cefr,
    });
  }
  return entries;
}

/**
 * Calculate Word Error Rate between reference and hypothesis.
 */
export function calculateWER(reference: string, hypothesis: string): number {
  const refWords = normalize(reference)
    .split(/\s+/)
    .filter((w) => w);
  const hypWords = normalize(hypothesis)
    .split(/\s+/)
    .filter((w) => w);

  if (refWords.length === 0) return hypWords.length === 0 ? 0 : 1;

  const m = refWords.length;
  const n = hypWords.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        refWords[i - 1] === hypWords[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n] / m;
}

/**
 * Shuffle array in place using Fisher-Yates algorithm.
 */
export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
