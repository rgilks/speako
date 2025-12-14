/**
 * Results table for validation page.
 */

import { ValidationResult } from '../../types/validation';

interface ResultsTableProps {
  results: ValidationResult[];
  selectedFileId: string | null;
  onSelectResult: (result: ValidationResult) => void;
}

export function ResultsTable({ results, selectedFileId, onSelectResult }: ResultsTableProps) {
  return (
    <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '1rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, background: 'var(--card-bg, #1a1a1a)' }}>
            <th style={{ textAlign: 'left', padding: '6px' }}>WER</th>
            <th style={{ textAlign: 'left', padding: '6px' }}>CEFR (Detected/Expected)</th>
            <th style={{ textAlign: 'left', padding: '6px' }}>Clarity</th>
            <th style={{ textAlign: 'left', padding: '6px' }}>Grammar</th>
            <th style={{ textAlign: 'left', padding: '6px' }}>Words</th>
            <th style={{ textAlign: 'left', padding: '6px' }}>Transcript Sample</th>
          </tr>
        </thead>
        <tbody>
          {results.map(r => (
            <tr 
              key={r.fileId} 
              onClick={() => onSelectResult(r)}
              style={{ 
                borderBottom: '1px solid rgba(255,255,255,0.05)', 
                cursor: 'pointer',
                background: selectedFileId === r.fileId ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                transition: 'background 0.15s ease'
              }}
            >
              <td style={{ padding: '6px', color: r.wer < 0.2 ? '#4ade80' : r.wer < 0.4 ? '#fbbf24' : '#f87171', fontWeight: 'bold' }}>
                {(r.wer * 100).toFixed(0)}%
              </td>
              <td style={{ padding: '6px' }}>
                <span style={{ color: r.cefrMatch ? '#4ade80' : '#f87171' }}>
                  {r.detectedCEFR}
                </span>
                <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                  ({r.labeledCEFR})
                </span>
              </td>
              <td style={{ padding: '6px' }}>{r.clarityScore}</td>
              <td style={{ padding: '6px', color: r.grammarIssues === 0 ? '#4ade80' : '#fbbf24' }}>
                {r.grammarIssues}
              </td>
              <td style={{ padding: '6px' }}>{r.wordCount}</td>
              <td style={{ padding: '6px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.hypothesis}>
                {r.hypothesis.slice(0, 60)}...
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
