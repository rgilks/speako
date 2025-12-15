import { Signal } from '@preact/signals';
import { AudioLevelIndicator } from '../AudioLevelIndicator';

interface RecordingPanelProps {
  currentTopic: Signal<string>;
  elapsedTime: Signal<number>;
  getAudioLevel: () => number;
  statusMsg: Signal<string>;
  handleStop: () => void;
}

export function RecordingPanel({
  currentTopic,
  elapsedTime,
  getAudioLevel,
  statusMsg,
  handleStop,
}: RecordingPanelProps) {
  return (
    <div className="recording-panel">
      <div
        style={{
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
        }}
      >
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--accent-glow)',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          Speaking Topic
        </span>
        <p
          style={{
            fontSize: '0.95rem',
            lineHeight: '1.4',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          {currentTopic.value}
        </p>
      </div>

      <p className="elapsed-timer" style={{ textAlign: 'center' }}>
        {Math.floor(elapsedTime.value / 60)
          .toString()
          .padStart(2, '0')}
        :{(elapsedTime.value % 60).toString().padStart(2, '0')}
      </p>

      <AudioLevelIndicator getLevel={getAudioLevel} barCount={7} />

      <p className="text-muted" style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
        {statusMsg.value}
      </p>

      <div style={{ textAlign: 'center' }}>
        <button className="btn-stop" onClick={handleStop}>
          Stop Recording
        </button>
      </div>
    </div>
  );
}
