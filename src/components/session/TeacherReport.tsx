import { AnalysisResult } from '../../logic/grammar-checker';
import { TranscriptionResult } from '../../logic/transcriber';
import { ComponentChildren } from 'preact';

interface FeedbackSectionProps {
  title: string;
  color: string;
  children: ComponentChildren;
}

function FeedbackSection({ title, color, children }: FeedbackSectionProps) {
  return (
    <div>
      <p className="metric-sublabel" style={{ color, marginBottom: '0.5rem' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function IssueItem({ issue }: { issue: any }) {
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.2)',
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <span style={{ fontSize: '0.8rem' }}>
          {issue.category === 'confidence' ? '🛡️' : issue.category === 'clarity' ? '👁️' : '💡'}
        </span>
        <span className="metric-sublabel">{issue.type}</span>
      </div>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
          margin: '0 0 4px 0',
        }}
      >
        {issue.message}
      </p>
      {issue.replacement && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>
          Try instead:{' '}
          <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{issue.replacement}</span>
        </p>
      )}
    </div>
  );
}

interface TeacherReportProps {
  analysis: AnalysisResult | null;
  transcript: TranscriptionResult | null;
}

export function TeacherReport({ analysis, transcript }: TeacherReportProps) {
  if (!analysis) return null;

  return (
    <div className="teacher-report">
      <div
        style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <p className="metric-label">Teacher&apos;s Report</p>
        <span style={{ fontSize: '1.2rem' }}>👨‍🏫</span>
      </div>

      <div
        style={{
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          maxHeight: '400px',
          overflowY: 'auto',
        }}
      >
        {analysis.positivePoints.length > 0 && (
          <FeedbackSection title="Strengths" color="#4ade80">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {analysis.positivePoints.map((point, idx) => (
                <div
                  key={`pos-${idx}`}
                  style={{ display: 'flex', gap: '10px', alignItems: 'start' }}
                >
                  <span style={{ color: '#4ade80', fontSize: '0.8rem', marginTop: '2px' }}>✨</span>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                    {point}
                  </p>
                </div>
              ))}
            </div>
          </FeedbackSection>
        )}

        {transcript?.words && transcript.words.some((w) => w.score < 0.7) && (
          <FeedbackSection title="Pronunciation Check" color="#ef4444">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {transcript.words
                .filter((w) => w.score < 0.7)
                .map((w, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.8rem',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#fca5a5',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    {w.word}
                  </span>
                ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
              Low confidence detected. Try articulating these words more clearly.
            </p>
          </FeedbackSection>
        )}

        <FeedbackSection title="Tips & Suggestions" color="#fbbf24">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {analysis.issues.length > 0 ? (
              analysis.issues.map((issue, idx) => <IssueItem key={idx} issue={issue} />)
            ) : (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                No specific grammar issues found. Keep it up!
              </p>
            )}
          </div>
        </FeedbackSection>
      </div>
    </div>
  );
}
