import { useState } from 'preact/hooks';
import { TranscriptionResult } from '../../logic/transcriber';

interface TranscriptBoxProps {
  transcript: TranscriptionResult | null;
}

export function TranscriptBox({ transcript }: TranscriptBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!transcript?.text) return;
    try {
      await navigator.clipboard.writeText(transcript.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div
      className="transcript-box"
      style={{
        padding: 0,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <p className="metric-label">Transcript</p>
          <span style={{ fontSize: '1.2rem' }}>📝</span>
        </div>
        <button
          onClick={handleCopy}
          disabled={!transcript?.text}
          style={{
            background: 'none',
            border: 'none',
            cursor: transcript?.text ? 'pointer' : 'default',
            opacity: transcript?.text ? 1 : 0.5,
            fontSize: '0.9rem',
            color: copied ? '#4ade80' : 'var(--text-tertiary)',
            transition: 'color 0.2s',
          }}
          title="Copy to clipboard"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div style={{ padding: '1.5rem', flex: 1, overflow: 'hidden' }}>
        {transcript?.text ? (
          <p
            style={{
              color: 'var(--text-secondary)',
              lineHeight: 1.8,
              maxHeight: '400px',
              overflowY: 'auto',
              margin: 0,
            }}
          >
            {transcript.text}
          </p>
        ) : (
          <p style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            No transcript available.
          </p>
        )}
      </div>
    </div>
  );
}
