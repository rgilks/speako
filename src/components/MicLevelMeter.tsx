import { AudioLevelIndicator } from './AudioLevelIndicator';
import { useMicrophoneAnalyser } from '../hooks/useMicrophoneAnalyser';

interface MicLevelMeterProps {
  deviceId: string;
}

/**
 * Real-time microphone level meter.
 * Uses AudioLevelIndicator for visualization, powered by real-time Web Audio analysis.
 */
export function MicLevelMeter({ deviceId }: MicLevelMeterProps) {
  const { isReady, getLevel } = useMicrophoneAnalyser(deviceId);

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

      <AudioLevelIndicator getLevel={getLevel} barCount={10} />

      <p className="mic-level-hint">Speak normally to test</p>
    </div>
  );
}
