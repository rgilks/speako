import { Signal } from '@preact/signals';
import { TranscriptionResult } from '../../logic/transcriber';
import { AnalysisResult } from '../../logic/grammar-checker';
import { MetricsGrid } from './MetricsGrid';
import { TranscriptBox } from './TranscriptBox';
import { TeacherReport } from './TeacherReport';
import { AudioVisualizer } from './AudioVisualizer';

interface SessionResultsProps {
  metrics: Signal<any>;
  analysis: Signal<AnalysisResult | null>;
  transcript: Signal<TranscriptionResult | null>;
  lastDuration: Signal<number>;
  handleRetry: () => void;
  statusMsg: Signal<string>;
}

export function SessionResults({
  metrics,
  analysis,
  transcript,
  lastDuration,
  handleRetry,
  statusMsg,
}: SessionResultsProps) {
  return (
    <div
      className="card-glass animate-fade-in mx-auto"
      style={{ width: '100%', maxWidth: '900px', textAlign: 'left' }}
    >
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h2 className="heading-lg mb-1">Session Results</h2>
          <p className="text-muted text-sm">
            {metrics.value
              ? "Great job! Here's how you performed."
              : 'Session completed. Review your results below.'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'block', fontSize: '1.8rem', fontWeight: 'bold', lineHeight: 1 }}>
            {lastDuration.value > 0
              ? new Date(lastDuration.value * 1000).toISOString().substr(14, 5)
              : '00:00'}
          </span>
          <span className="metric-label">Duration</span>
        </div>
      </div>

      {transcript.value?.audioBlob && (
        <AudioVisualizer audioBlob={transcript.value.audioBlob} words={transcript.value.words} />
      )}

      {metrics.value ? (
        <div className="dashboard-layout">
          <MetricsGrid metrics={metrics.value} clarityScore={analysis.value?.clarityScore ?? 0} />

          <div className="details-grid">
            <TranscriptBox transcript={transcript.value} />

            <TeacherReport analysis={analysis.value} transcript={transcript.value} />
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '2rem',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <p style={{ color: '#fca5a5', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Analysis Failed
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{statusMsg.value}</p>
        </div>
      )}

      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <button className="btn-primary" onClick={handleRetry}>
          Start New Session
        </button>
      </div>
    </div>
  );
}
