import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { calculateAudioLevel } from '../logic/audio-analysis';

interface UseMicrophoneAnalyserResult {
  isReady: boolean;
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
  if (audioContext) {
    await audioContext.close();
  }
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

    setIsReady(false);

    async function setupAudio() {
      try {
        cleanupStream(streamRef.current);
        await cleanupAudioContext(audioContextRef.current);

        const stream = await navigator.mediaDevices.getUserMedia(createAudioConstraints(deviceId));
        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();

        configureAnalyser(analyser);
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
      cleanupStream(streamRef.current);
      audioContextRef.current?.close();
    };
  }, [deviceId]);

  const getLevel = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return 0;
    return calculateAudioLevel(analyserRef.current, dataArrayRef.current);
  }, []);

  return { isReady, getLevel };
}
