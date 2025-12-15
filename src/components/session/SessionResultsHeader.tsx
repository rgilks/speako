import { Signal } from '@preact/signals';

interface SessionResultsHeaderProps {
  metrics: Signal<any>;
  lastDuration: Signal<number>;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function SessionResultsHeader({ metrics, lastDuration }: SessionResultsHeaderProps) {
  return (
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
          {formatDuration(lastDuration.value)}
        </span>
        <span className="metric-label">Duration</span>
      </div>
    </div>
  );
}
