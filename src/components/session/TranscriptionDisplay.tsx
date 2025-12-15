import { Signal } from '@preact/signals';
import { AudioLevelIndicator } from '../AudioLevelIndicator';

interface TranscriptionDisplayProps {
  view: Signal<'idle' | 'recording' | 'processing' | 'results'>;
  statusMsg: Signal<string>;
  elapsedTime: Signal<number>;
  currentTopic: Signal<string>;
  handleStop: () => void;
  getAudioLevel: () => number;
}

export function TranscriptionDisplay({
  view,
  statusMsg,
  elapsedTime,
  currentTopic,
  handleStop,
  getAudioLevel,
}: TranscriptionDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      {view.value === 'processing' ? (
        <>
          <div
            style={{
              width: 80,
              height: 80,
              border: '4px solid var(--accent-primary)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 2rem auto',
            }}
          ></div>
          <p className="heading-lg mb-2">Analyzing...</p>
          <p className="text-muted mb-10" style={{ minHeight: '1.5em' }}>
            {statusMsg.value}
          </p>
        </>
      ) : (
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

          <p
            className="text-muted"
            style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}
          >
            {statusMsg.value}
          </p>

          <div style={{ textAlign: 'center' }}>
            <button className="btn-stop" onClick={handleStop}>
              Stop Recording
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
