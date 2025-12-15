/**
 * Validation controls panel.
 */

interface ValidationControlsProps {
  fileLimit: number;
  isRunning: boolean;
  isComplete: boolean;
  onFileLimitChange: (limit: number) => void;
  onStartValidation: () => void;
}

export function ValidationControls({
  fileLimit,
  isRunning,
  isComplete,
  onFileLimitChange,
  onStartValidation,
}: ValidationControlsProps) {
  if (isRunning) return null;

  return (
    <div
      style={{
        marginTop: '1rem',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <label>
        Files:
        <input
          type="number"
          value={fileLimit}
          onChange={(e) => onFileLimitChange(parseInt((e.target as HTMLInputElement).value) || 10)}
          style={{
            marginLeft: '0.5rem',
            width: '60px',
            padding: '6px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            color: 'inherit',
          }}
        />
      </label>
      <button className="btn-primary" onClick={onStartValidation}>
        {isComplete ? 'Run Again' : 'Start Validation'}
      </button>
    </div>
  );
}
