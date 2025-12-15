import { Signal } from '@preact/signals';
import { DevicePicker } from '../DevicePicker';
import { MicLevelMeter } from '../MicLevelMeter';
import { ModelLoadingState } from '../../logic/local-transcriber';

function TopicDisplay({ topic, onGenerate }: { topic: string; onGenerate: () => void }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--accent-secondary)',
          }}
        >
          Speaking Topic
        </span>
        <button
          onClick={onGenerate}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
          title="New Topic"
        >
          🔄
        </button>
      </div>
      <p style={{ fontSize: '1.1rem', lineHeight: '1.4', fontWeight: 500 }}>{topic}</p>
    </div>
  );
}

interface TopicGeneratorCardProps {
  modelLoadingState: Signal<ModelLoadingState>;
  selectedDeviceId: Signal<string>;
  currentTopic: Signal<string>;
  generateTopic: () => void;
}

export function TopicGeneratorCard({
  modelLoadingState,
  selectedDeviceId,
  currentTopic,
  generateTopic,
}: TopicGeneratorCardProps) {
  if (!modelLoadingState.value.isLoaded) return null;

  return (
    <div
      className="card-glass"
      style={{
        margin: '0 auto 2rem auto',
        maxWidth: '400px',
        textAlign: 'left',
        padding: '1.5rem',
      }}
    >
      <DevicePicker
        selectedDeviceId={selectedDeviceId.value}
        onDeviceChange={(id) => {
          selectedDeviceId.value = id;
        }}
      />

      {selectedDeviceId.value && <MicLevelMeter deviceId={selectedDeviceId.value} />}

      <TopicDisplay topic={currentTopic.value} onGenerate={generateTopic} />
    </div>
  );
}
