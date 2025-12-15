import { STMEntry } from '../types/validation';

const PUNCTUATION_PATTERN = /[.,!?;:'"()[\]{}]/g;
const WHITESPACE_PATTERN = /\s+/g;
const STM_COMMENT_PREFIX = ';;';
const STM_LINE_PATTERN = /^(\S+)\s+\S+\s+\S+\s+[\d.]+\s+[\d.]+\s+<([^>]+)>\s+(.*)$/;
const CEFR_PATTERN = /,([ABC][12]?),/;
const UNKNOWN_CEFR = 'Unknown';
const PERCENT_NOISE_PATTERN = /\(%[^)]+%\)/g;
const DASH_NOISE_PATTERN = /\([^)]*-\)/g;

function cleanTranscript(transcript: string): string {
  return transcript
    .replace(PERCENT_NOISE_PATTERN, '')
    .replace(DASH_NOISE_PATTERN, '')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim()
    .toLowerCase();
}

function extractCEFR(metadata: string): string {
  const match = metadata.match(CEFR_PATTERN);
  return match ? match[1] : UNKNOWN_CEFR;
}

function splitWords(text: string): string[] {
  return normalize(text)
    .split(WHITESPACE_PATTERN)
    .filter((w) => w);
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(PUNCTUATION_PATTERN, '')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
}

export function parseSTM(content: string): Map<string, STMEntry> {
  const entries = new Map<string, STMEntry>();
  const segments: Map<string, { cefr: string; transcripts: string[] }> = new Map();

  for (const line of content.split('\n')) {
    if (line.startsWith(STM_COMMENT_PREFIX) || !line.trim()) continue;

    const match = line.match(STM_LINE_PATTERN);
    if (match) {
      const [, fileId, metadata, transcript] = match;
      const labeledCEFR = extractCEFR(metadata);
      const clean = cleanTranscript(transcript);

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

export function calculateWER(reference: string, hypothesis: string): number {
  const refWords = splitWords(reference);
  const hypWords = splitWords(hypothesis);

  if (refWords.length === 0) return hypWords.length === 0 ? 0 : 1;

  const refLength = refWords.length;
  const hypLength = hypWords.length;
  const dp: number[][] = Array(refLength + 1)
    .fill(null)
    .map(() => Array(hypLength + 1).fill(0));

  for (let i = 0; i <= refLength; i++) dp[i][0] = i;
  for (let j = 0; j <= hypLength; j++) dp[0][j] = j;

  for (let i = 1; i <= refLength; i++) {
    for (let j = 1; j <= hypLength; j++) {
      dp[i][j] =
        refWords[i - 1] === hypWords[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[refLength][hypLength] / refLength;
}

export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
