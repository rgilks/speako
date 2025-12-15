/**
 * Audio Analysis Utilities
 * Shared logic for calculating audio levels from Web Audio API AnalyserNode.
 */

/**
 * Calculates the current audio level from an AnalyserNode using RMS (Root Mean Square).
 * This provides a much more accurate representation of perceived loudness than peak amplitude.
 *
 * @param analyser The Web Audio AnalyserNode to read data from
 * @param dataArray The Uint8Array buffer to store time domain data
 * @returns Normalized audio level (0.0 to 1.0) with amplification for speech
 */
export function calculateAudioLevel(analyser: AnalyserNode, dataArray: Uint8Array): number {
  // Use time domain data (waveform) for better speech sensitivity
  // We cast to any because of a TypeScript lib type mismatch (ArrayBufferLike vs ArrayBuffer)
  analyser.getByteTimeDomainData(dataArray as any);

  // Calculate RMS (average energy)
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    // Convert 0..255 range to -1..1 range (centered at 128)
    const value = (dataArray[i] - 128) / 128;
    sum += value * value;
  }
  const rms = Math.sqrt(sum / dataArray.length);

  // Amplify typical speech (RMS 0.05-0.2) to 0.0-1.0 range
  // A factor of 6x maps normal speech well to visualizers
  const amplified = Math.min(1.0, rms * 6);

  return amplified;
}
