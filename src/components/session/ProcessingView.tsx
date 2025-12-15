import { Signal } from '@preact/signals';

interface ProcessingViewProps {
  statusMsg: Signal<string>;
}

export function ProcessingView({ statusMsg }: ProcessingViewProps) {
  return (
    <>
      <div
        style={{
          width: 80,
          height: 80,
          border: '4px solid var(--accent-primary)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 2rem auto',
        }}
      ></div>
      <p className="heading-lg mb-2">Analyzing...</p>
      <p className="text-muted mb-10" style={{ minHeight: '1.5em' }}>
        {statusMsg.value}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
