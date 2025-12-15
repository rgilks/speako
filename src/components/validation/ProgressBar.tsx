interface ProgressBarProps {
  progress: number;
  total: number;
}

export function ProgressBar({ progress, total }: ProgressBarProps) {
  if (total === 0) return null;

  return (
    <div style={{ marginTop: '1rem' }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          height: '6px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#8b5cf6',
            height: '100%',
            width: `${(progress / total) * 100}%`,
          }}
        />
      </div>
      <small>
        {progress}/{total}
      </small>
    </div>
  );
}
