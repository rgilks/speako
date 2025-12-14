
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

export function MetricsGrid({ metrics, clarityScore }: MetricsGridProps) {
  return (
    <>
      {/* Top Row: Primary Scores */}
      <div className="primary-metrics-grid">
          {/* Pronunciation */}
          <div className="metric-card-premium pronunciation">
              <span className="value">
                  {metrics.pronunciation_score ?? 0}%
              </span>
              <span className="metric-label" style={{ color: 'var(--accent-success)' }}>Pronunciation</span>
          </div>

          {/* Clarity */}
          <div className="metric-card-premium clarity">
               <span className="value">
                  {clarityScore ?? 0}
              </span>
              <span className="metric-label" style={{ color: '#f59e0b' }}>Clarity Score</span>
          </div>

          {/* CEFR */}
          <div className="metric-card-premium cefr">
              <span className="value">
                  {metrics.cefr_level}
              </span>
              <span className="metric-label" style={{ color: '#3b82f6' }}>CEFR Level</span>
          </div>
      </div>

      {/* Secondary Stats */}
      <div className="secondary-metrics-grid">
           <div className="secondary-stat-item">
               <span className="metric-subvalue">{metrics.word_count}</span>
               <span style={{ display: 'block' }} className="metric-sublabel">Total Words</span>
           </div>
           <div className="secondary-stat-item">
               <span className="metric-subvalue">
                  {metrics.wpm}
               </span>
               <span style={{ display: 'block' }} className="metric-sublabel">WPM</span>
           </div>
           <div className="secondary-stat-item">
               <span className="metric-subvalue">{metrics.unique_words}</span>
               <span style={{ display: 'block' }} className="metric-sublabel">Unique</span>
           </div>
           <div className="secondary-stat-item">
               <span className="metric-subvalue">{metrics.complex_words}</span>
               <span style={{ display: 'block' }} className="metric-sublabel">Complex</span>
           </div>
      </div>
    </>
  );
}
