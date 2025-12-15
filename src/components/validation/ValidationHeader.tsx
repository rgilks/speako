export function ValidationHeader() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>🧪 Full Pipeline Validation</h1>
        <span
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
          }}
        >
          ⚡ WebGPU
        </span>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Validates: Transcription (WER), CEFR Detection, Metrics, Grammar
      </p>
    </>
  );
}
