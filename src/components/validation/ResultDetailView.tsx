/**
 * Detailed view for a single validation result.
 */

import { ValidationResult } from '../../types/validation';
import { AudioVisualizer } from '../session/AudioVisualizer';
import { MetricsGrid } from '../session/MetricsGrid';
import { TeacherReport } from '../session/TeacherReport';

function ComparisonView({ reference, hypothesis }: { reference: string; hypothesis: string }) {
  return (
    <div
      style={{
        marginTop: '1.5rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
      }}
    >
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
        <h4 style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Reference (Expected)
        </h4>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{reference}</p>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
        <h4 style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Transcription (Detected)
        </h4>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{hypothesis}</p>
      </div>
    </div>
  );
}

function StatsSummary({ result }: { result: ValidationResult }) {
  return (
    <div
      style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '8px',
      }}
    >
      <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: result.wer < 0.2 ? '#4ade80' : result.wer < 0.4 ? '#fbbf24' : '#f87171',
            }}
          >
            {(result.wer * 100).toFixed(1)}%
          </div>
          <small>Word Error Rate</small>
        </div>
        <div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: result.cefrMatch ? '#4ade80' : '#f87171',
            }}
          >
            {result.detectedCEFR} / {result.labeledCEFR}
          </div>
          <small>Detected / Expected CEFR</small>
        </div>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{result.processingTimeMs}ms</div>
          <small>Processing Time</small>
        </div>
      </div>
    </div>
  );
}

interface ResultDetailViewProps {
  result: ValidationResult;
  onClose: () => void;
}

export function ResultDetailView({ result, onClose }: ResultDetailViewProps) {
  return (
    <div className="card-glass" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h3 style={{ margin: 0 }}>📋 {result.fileId}</h3>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            color: 'inherit',
          }}
        >
          ✕ Close
        </button>
      </div>

      {result.audioBlob && <AudioVisualizer audioBlob={result.audioBlob} words={result.words} />}

      {result.fullMetrics && (
        <MetricsGrid
          metrics={{
            ...result.fullMetrics,
            wpm: 0,
            pronunciation_score: result.fullMetrics.pronunciation_score ?? 0,
          }}
          clarityScore={result.clarityScore}
        />
      )}

      <ComparisonView reference={result.reference} hypothesis={result.hypothesis} />

      {result.grammarAnalysis && (
        <div style={{ marginTop: '1.5rem' }}>
          <TeacherReport
            analysis={result.grammarAnalysis}
            transcript={{ text: result.hypothesis, words: result.words || [] }}
          />
        </div>
      )}

      <StatsSummary result={result} />
    </div>
  );
}
