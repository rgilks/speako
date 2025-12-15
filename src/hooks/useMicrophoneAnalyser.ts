import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { calculateAudioLevel } from '../logic/audio-analysis';

interface UseMicrophoneAnalyserResult {
  isReady: boolean;
  error: string | null;
  getLevel: () => number;
}

// Constants
const ANALYSER_CONFIG = {
  fftSize: 512,
  smoothingTimeConstant: 0.3,
} as const;

const AUDIO_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
} as const;

function createAudioConstraints(deviceId: string): MediaStreamConstraints {
  return {
    audio: {
      deviceId: { exact: deviceId },
      ...AUDIO_CONSTRAINTS,
    },
  };
}

function configureAnalyser(analyser: AnalyserNode) {
  analyser.fftSize = ANALYSER_CONFIG.fftSize;
  analyser.smoothingTimeConstant = ANALYSER_CONFIG.smoothingTimeConstant;
}

function cleanupStream(stream: MediaStream | null) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

async function cleanupAudioContext(audioContext: AudioContext | null) {
  if (audioContext && audioContext.state !== 'closed') {
    try {
      await audioContext.close();
    } catch (err) {
      // Ignore errors if context is already closed or closing
      if (err instanceof Error && !err.message.includes('closed')) {
        console.warn('[useMicrophoneAnalyser] Error closing AudioContext:', err);
      }
    }
  }
}

/**
 * Hook to set up a microphone audio analyser.
 * Returns `isReady` state and a `getLevel` function for real-time audio level.
 */
export function useMicrophoneAnalyser(deviceId: string): UseMicrophoneAnalyserResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setIsReady(false);
      setError(null);
      return;
    }

    setIsReady(false);
    setError(null);

    let cancelled = false;

    async function setupAudio() {
      try {
        // Clean up previous resources
        cleanupStream(streamRef.current);
        await cleanupAudioContext(audioContextRef.current);

        if (cancelled) return;

        const stream = await navigator.mediaDevices.getUserMedia(createAudioConstraints(deviceId));

        if (cancelled) {
          cleanupStream(stream);
          return;
        }

        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();

        configureAnalyser(analyser);
        source.connect(analyser);
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.fftSize);

        if (!cancelled) {
          setIsReady(true);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;

        console.error('[useMicrophoneAnalyser] Error accessing microphone:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to access microphone';
        setError(errorMessage);
        setIsReady(false);
      }
    }

    setupAudio();

    return () => {
      cancelled = true;
      cleanupStream(streamRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {
          // Ignore errors when closing during cleanup
        });
      }
    };
  }, [deviceId]);

  const getLevel = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return 0;
    return calculateAudioLevel(analyserRef.current, dataArrayRef.current);
  }, []);

  return { isReady, error, getLevel };
}
