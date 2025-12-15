/**
 * Summary statistics cards for validation results.
 */

interface SummaryCardsProps {
  avgWER: number;
  cefrAccuracy: number;
  avgClarity: number;
  totalFiles: number;
}

export function SummaryCards({ avgWER, cefrAccuracy, avgClarity, totalFiles }: SummaryCardsProps) {
  const cardStyle = (condition: 'good' | 'warning' | 'bad') => ({
    background:
      condition === 'good'
        ? 'rgba(34, 197, 94, 0.1)'
        : condition === 'warning'
          ? 'rgba(245, 158, 11, 0.1)'
          : 'rgba(239, 68, 68, 0.1)',
    padding: '1rem',
    borderRadius: '8px',
    textAlign: 'center' as const,
  });

  const getWERCondition = (wer: number) => (wer < 0.2 ? 'good' : wer < 0.4 ? 'warning' : 'bad');
  const getAccuracyCondition = (acc: number) =>
    acc > 0.6 ? 'good' : acc > 0.4 ? 'warning' : 'bad';
  const getClarityCondition = (clarity: number) =>
    clarity > 80 ? 'good' : clarity > 60 ? 'warning' : 'bad';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={cardStyle(getWERCondition(avgWER))}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{(avgWER * 100).toFixed(0)}%</div>
        <small>Avg WER</small>
      </div>
      <div style={cardStyle(getAccuracyCondition(cefrAccuracy))}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          {(cefrAccuracy * 100).toFixed(0)}%
        </div>
        <small>CEFR Match</small>
      </div>
      <div style={cardStyle(getClarityCondition(avgClarity))}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{avgClarity.toFixed(0)}</div>
        <small>Avg Clarity</small>
      </div>
      <div
        style={{
          background: 'rgba(99, 102, 241, 0.1)',
          padding: '1rem',
          borderRadius: '8px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{totalFiles}</div>
        <small>Files Processed</small>
      </div>
    </div>
  );
}
