import { useEffect, useRef, useState } from 'preact/hooks';
import { AudioLevelIndicator } from './AudioLevelIndicator';
import { calculateAudioLevel } from '../logic/audio-analysis';

interface MicLevelMeterProps {
  deviceId: string;
}

/**
 * Real-time microphone level meter.
 * Uses AudioLevelIndicator for visualization, powered by real-time Web Audio analysis.
 */
export function MicLevelMeter({ deviceId }: MicLevelMeterProps) {
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

        analyser.fftSize = 512; // Larger window for better bass resolution if needed, but we use time domain
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.fftSize);

        setIsReady(true);
      } catch (err) {
        console.error('[MicLevelMeter] Error accessing microphone:', err);
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

  // This function will be called ~60fps by the AudioLevelIndicator
  const getLevel = () => {
    if (!analyserRef.current || !dataArrayRef.current) return 0;
    return calculateAudioLevel(analyserRef.current, dataArrayRef.current);
  };

  if (!isReady) {
    return (
      <div className="mic-level-meter" style={{ textAlign: 'center', opacity: 0.5 }}>
        <p className="mic-level-hint">Connecting to microphone...</p>
      </div>
    );
  }

  return (
    <div className="mic-level-meter">
      <div className="mic-level-header">
        <span className="mic-level-label">🔊 Mic Check</span>
      </div>

      {/* Reusing the app's standard visualizer */}
      <AudioLevelIndicator getLevel={getLevel} barCount={10} />

      <p className="mic-level-hint">Speak normally to test</p>
    </div>
  );
}
