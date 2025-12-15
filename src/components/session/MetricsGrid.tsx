interface MetricsGridProps {
  metrics: {
    pronunciation_score: number;
    cefr_level: string;
    word_count: number;
    wpm: number;
    unique_words: number;
    complex_words: number;
  };
  clarityScore: number;
}

interface MetricCardProps {
  value: string | number;
  label: string;
  className: string;
  color: string;
}

function MetricCard({ value, label, className, color }: MetricCardProps) {
  return (
    <div className={`metric-card-premium ${className}`}>
      <span className="value">{value}</span>
      <span className="metric-label" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

interface SecondaryStatProps {
  value: number;
  label: string;
}

function SecondaryStat({ value, label }: SecondaryStatProps) {
  return (
    <div className="secondary-stat-item">
      <span className="metric-subvalue">{value}</span>
      <span style={{ display: 'block' }} className="metric-sublabel">
        {label}
      </span>
    </div>
  );
}

export function MetricsGrid({ metrics, clarityScore }: MetricsGridProps) {
  const primaryMetrics = [
    {
      className: 'pronunciation',
      value: `${metrics.pronunciation_score ?? 0}%`,
      label: 'Pronunciation',
      color: 'var(--accent-success)',
    },
    {
      className: 'clarity',
      value: clarityScore ?? 0,
      label: 'Clarity Score',
      color: '#f59e0b',
    },
    {
      className: 'cefr',
      value: metrics.cefr_level,
      label: 'CEFR Level',
      color: '#3b82f6',
    },
  ];

  const secondaryMetrics = [
    { value: metrics.word_count, label: 'Total Words' },
    { value: metrics.wpm, label: 'WPM' },
    { value: metrics.unique_words, label: 'Unique' },
    { value: metrics.complex_words, label: 'Complex' },
  ];

  return (
    <>
      <div className="primary-metrics-grid">
        {primaryMetrics.map((metric) => (
          <MetricCard
            key={metric.label}
            className={metric.className}
            value={metric.value}
            label={metric.label}
            color={metric.color}
          />
        ))}
      </div>

      <div className="secondary-metrics-grid">
        {secondaryMetrics.map((stat) => (
          <SecondaryStat key={stat.label} value={stat.value} label={stat.label} />
        ))}
      </div>
    </>
  );
}
