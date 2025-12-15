import { Signal } from '@preact/signals';
import { TranscriptionResult } from '../../logic/transcriber';
import { AnalysisResult } from '../../logic/grammar-checker';
import { MetricsGrid } from './MetricsGrid';
import { TranscriptBox } from './TranscriptBox';
import { TeacherReport } from './TeacherReport';
import { AudioVisualizer } from './AudioVisualizer';
import { SessionResultsHeader } from './SessionResultsHeader';

interface SessionResultsProps {
  metrics: Signal<any>;
  analysis: Signal<AnalysisResult | null>;
  transcript: Signal<TranscriptionResult | null>;
  lastDuration: Signal<number>;
  handleRetry: () => void;
  statusMsg: Signal<string>;
}

function AnalysisErrorView({ statusMsg }: { statusMsg: Signal<string> }) {
  return (
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
  );
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
      <SessionResultsHeader metrics={metrics} lastDuration={lastDuration} />

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
        <AnalysisErrorView statusMsg={statusMsg} />
      )}

      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <button className="btn-primary" onClick={handleRetry}>
          Start New Session
        </button>
      </div>
    </div>
  );
}
