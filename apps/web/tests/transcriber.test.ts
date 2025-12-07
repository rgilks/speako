import { describe, it, expect } from 'vitest';
import { FakeTranscriber } from '../src/logic/transcriber';

describe('FakeTranscriber', () => {
  it('returns a fixed string after stop', async () => {
    const t = new FakeTranscriber();
    await t.start();
    const result = await t.stop();
    expect(result).toContain("This is a fake transcript");
  });
});
