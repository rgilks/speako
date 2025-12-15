import { describe, it, expect } from 'vitest';
import { FakeTranscriber } from './transcriber';

describe('FakeTranscriber', () => {
  it('returns expected transcription result', async () => {
    const transcriber = new FakeTranscriber();
    await transcriber.start();
    const result = await transcriber.stop();

    expect(result.text).toContain('This is a fake transcript');
    expect(result.words).toBeInstanceOf(Array);
    expect(result.words.length).toBeGreaterThan(0);
    expect(result.words[0]).toHaveProperty('word');
    expect(result.words[0]).toHaveProperty('start');
    expect(result.words[0]).toHaveProperty('end');
    expect(result.words[0]).toHaveProperty('score');
  });
});
