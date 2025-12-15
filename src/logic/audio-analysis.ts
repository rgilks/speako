/**
 * Audio Analysis Utilities
 * Shared logic for calculating audio levels from Web Audio API AnalyserNode.
 */

const BYTE_CENTER = 128;
const BYTE_RANGE = 128;
const SPEECH_AMPLIFICATION = 6;
const MAX_LEVEL = 1.0;

/**
 * Calculates audio level from AnalyserNode using RMS for accurate perceived loudness.
 *
 * @param analyser Web Audio AnalyserNode to read from
 * @param dataArray Uint8Array buffer for time domain data
 * @returns Normalized level (0.0-1.0) amplified for speech visualization
 */
export function calculateAudioLevel(analyser: AnalyserNode, dataArray: Uint8Array): number {
  // TypeScript lib type mismatch: getByteTimeDomainData expects ArrayBuffer, but Uint8Array uses ArrayBufferLike
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analyser.getByteTimeDomainData(dataArray as any);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const value = (dataArray[i] - BYTE_CENTER) / BYTE_RANGE;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / dataArray.length);

  return Math.min(MAX_LEVEL, rms * SPEECH_AMPLIFICATION);
}
