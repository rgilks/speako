/**
 * Summary statistics cards for validation results.
 */

interface SummaryCardsProps {
  avgWER: number;
  cefrAccuracy: number;
  avgClarity: number;
  totalFiles: number;
}

type StatCondition = 'good' | 'warning' | 'bad' | 'neutral';

function StatCard({
  value,
  label,
  condition,
}: {
  value: string | number;
  label: string;
  condition: StatCondition;
}) {
  const getBackground = (c: StatCondition) => {
    switch (c) {
      case 'good':
        return 'rgba(34, 197, 94, 0.1)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.1)';
      case 'bad':
        return 'rgba(239, 68, 68, 0.1)';
      default:
        return 'rgba(99, 102, 241, 0.1)';
    }
  };

  return (
    <div
      style={{
        background: getBackground(condition),
        padding: '1rem',
        borderRadius: '8px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{value}</div>
      <small>{label}</small>
    </div>
  );
}

export function SummaryCards({ avgWER, cefrAccuracy, avgClarity, totalFiles }: SummaryCardsProps) {
  const getWERCondition = (wer: number): StatCondition =>
    wer < 0.2 ? 'good' : wer < 0.4 ? 'warning' : 'bad';
  const getAccuracyCondition = (acc: number): StatCondition =>
    acc > 0.6 ? 'good' : acc > 0.4 ? 'warning' : 'bad';
  const getClarityCondition = (clarity: number): StatCondition =>
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
      <StatCard
        value={`${(avgWER * 100).toFixed(0)}%`}
        label="Avg WER"
        condition={getWERCondition(avgWER)}
      />
      <StatCard
        value={`${(cefrAccuracy * 100).toFixed(0)}%`}
        label="CEFR Match"
        condition={getAccuracyCondition(cefrAccuracy)}
      />
      <StatCard
        value={avgClarity.toFixed(0)}
        label="Avg Clarity"
        condition={getClarityCondition(avgClarity)}
      />
      <StatCard value={totalFiles} label="Files Processed" condition="neutral" />
    </div>
  );
}
