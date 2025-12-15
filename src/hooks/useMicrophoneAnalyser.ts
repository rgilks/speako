import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { calculateAudioLevel } from '../logic/audio-analysis';

interface UseMicrophoneAnalyserResult {
  isReady: boolean;
  getLevel: () => number;
}

/**
 * Hook to set up a microphone audio analyser.
 * Returns `isReady` state and a `getLevel` function for real-time audio level.
 */
export function useMicrophoneAnalyser(deviceId: string): UseMicrophoneAnalyserResult {
  const [isReady, setIsReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    // Reset ready state when device changes
    setIsReady(false);

    async function setupAudio() {
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (audioContextRef.current) {
          await audioContextRef.current.close();
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();

        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.fftSize);

        setIsReady(true);
      } catch (err) {
        console.error('[useMicrophoneAnalyser] Error accessing microphone:', err);
      }
    }

    setupAudio();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [deviceId]);

  const getLevel = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return 0;
    return calculateAudioLevel(analyserRef.current, dataArrayRef.current);
  }, []);

  return { isReady, getLevel };
}
